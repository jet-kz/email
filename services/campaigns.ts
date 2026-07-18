import { supabaseAdmin } from "@/lib/supabase";
import { Campaign, CampaignStatus, CampaignContact, CampaignLog, Contact } from "@/types";
import { publishQueueJob } from "@/lib/qstash";
import { sendEmail } from "@/lib/resend";
import { interpolate } from "@/utils/personalization";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getActiveUserId(): Promise<string> {
  const { data: { user } } = await supabaseAdmin.auth.getUser().catch(() => ({ data: { user: null } }));
  return user?.id || DEFAULT_USER_ID;
}

// 1. Fetch campaigns
export async function getCampaigns(search?: string, status?: string): Promise<Campaign[]> {
  try {
    const userId = await getActiveUserId();
    let query = supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (status) {
      query = query.eq("status", status);
    }

    const { data, error } = await query;
    if (error) throw error;

    let list = data || [];
    if (search) {
      const s = search.toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(s) || (c.subject && c.subject.toLowerCase().includes(s)));
    }
    return list;
  } catch (err) {
    console.error("Error fetching campaigns:", err);
    return [];
  }
}

// 2. Fetch single campaign
export async function getCampaign(campaignId: string): Promise<Campaign | null> {
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .select("*")
    .eq("id", campaignId)
    .maybeSingle();

  if (error) throw error;
  return data;
}

// 3. Create Campaign
export async function createCampaign(campaign: Omit<Partial<Campaign>, "id" | "user_id" | "created_at" | "updated_at">): Promise<Campaign> {
  const userId = await getActiveUserId();
  const { data, error } = await supabaseAdmin
    .from("campaigns")
    .insert({
      user_id: userId,
      name: campaign.name || "Untitled Campaign",
      subject: campaign.subject || "",
      preview_text: campaign.preview_text || "",
      content: campaign.content || "",
      status: "draft",
      emails_per_batch: campaign.emails_per_batch || 100,
      delay_between_batches: campaign.delay_between_batches || 60,
      max_retries: campaign.max_retries || 3,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// 4. Update Campaign
export async function updateCampaign(campaignId: string, campaign: Partial<Campaign>): Promise<void> {
  const { error } = await supabaseAdmin
    .from("campaigns")
    .update({
      ...campaign,
      updated_at: new Date().toISOString(),
    })
    .eq("id", campaignId);

  if (error) throw error;
}

// 5. Delete Campaign
export async function deleteCampaign(campaignId: string): Promise<void> {
  const { error } = await supabaseAdmin.from("campaigns").delete().eq("id", campaignId);
  if (error) throw error;
}

// 6. Duplicate Campaign
export async function duplicateCampaign(campaignId: string): Promise<Campaign> {
  const original = await getCampaign(campaignId);
  if (!original) throw new Error("Original campaign not found");

  const duplicated = await createCampaign({
    name: `Copy of ${original.name}`,
    subject: original.subject || "",
    preview_text: original.preview_text || "",
    content: original.content || "",
    emails_per_batch: original.emails_per_batch,
    delay_between_batches: original.delay_between_batches,
    max_retries: original.max_retries,
  });

  return duplicated;
}

// 7. Log Campaign Activity
export async function logCampaignActivity(campaignId: string, level: "info" | "warn" | "error", message: string): Promise<void> {
  await supabaseAdmin.from("campaign_logs").insert({
    campaign_id: campaignId,
    log_level: level,
    message,
  });
}

// 8. Fetch Logs
export async function getCampaignLogs(campaignId: string): Promise<CampaignLog[]> {
  const { data, error } = await supabaseAdmin
    .from("campaign_logs")
    .select("*")
    .eq("campaign_id", campaignId)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) throw error;
  return data || [];
}

// 9. Fetch detailed sending stats
export async function getCampaignStats(campaignId: string) {
  const { data, error } = await supabaseAdmin
    .from("campaign_contacts")
    .select("status");

  if (error) throw error;

  const stats = {
    queued: 0,
    sending: 0,
    sent: 0,
    failed: 0,
    bounced: 0,
    unsubscribed: 0,
  };

  if (data) {
    const campaignData = data.filter((cc: any) => cc.campaign_id === campaignId || true); // we query only for this campaign using filter or raw sql.
  }

  // To be highly performant and precise, let's write a targeted SQL count query:
  const { data: counted, error: countError } = await supabaseAdmin
    .from("campaign_contacts")
    .select("status")
    .eq("campaign_id", campaignId);

  if (countError) throw countError;

  if (counted) {
    counted.forEach((row) => {
      const statusKey = row.status as keyof typeof stats;
      if (stats[statusKey] !== undefined) {
        stats[statusKey]++;
      }
    });
  }

  return stats;
}

// 10. TEST SEND CAMPAIGN
export async function sendTestCampaignEmail(campaignId: string, testEmail: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  const mockContact = {
    first_name: "Test",
    last_name: "Recipient",
    company: "Test Company Inc.",
    email: testEmail,
  };

  const subject = interpolate(campaign.subject, mockContact);
  const html = interpolate(campaign.content, mockContact);

  await sendEmail({
    to: testEmail,
    subject: `[TEST] ${subject}`,
    html,
  });

  await logCampaignActivity(campaignId, "info", `Test email successfully dispatched to ${testEmail}`);
}

// 11. START SENDING (SCHEDULING JOBS IN QSTASH)
export async function startCampaignSending(campaignId: string, targetTagId?: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status === "sending") return;

  await logCampaignActivity(campaignId, "info", "Compiling recipient targets...");

  // Fetch target contacts
  const userId = await getActiveUserId();
  let contactQuery = supabaseAdmin.from("contacts").select("id, first_name, last_name, email, company").eq("user_id", userId);
  
  if (targetTagId) {
    // If filtering by tags, get contacts linked to that tag
    const { data: linkedContactIds } = await supabaseAdmin
      .from("contact_tags")
      .select("contact_id")
      .eq("tag_id", targetTagId);

    const ids = (linkedContactIds || []).map((l) => l.contact_id);
    if (ids.length === 0) {
      throw new Error("No contacts found with the selected filter tag.");
    }
    contactQuery = contactQuery.in("id", ids);
  }

  const { data: contacts, error: fetchErr } = await contactQuery;
  if (fetchErr) throw fetchErr;
  if (!contacts || contacts.length === 0) {
    throw new Error("Target recipient list is empty. Add contacts before sending campaigns.");
  }

  // Set status to sending immediately
  await updateCampaign(campaignId, { status: "sending", sent_at: new Date().toISOString() });
  await logCampaignActivity(campaignId, "info", `Initializing queue for ${contacts.length} recipients.`);

  // Create queue records in bulk
  const campaignContacts = contacts.map((c) => ({
    campaign_id: campaignId,
    contact_id: c.id,
    status: "queued",
  }));

  const { error: insertErr } = await supabaseAdmin
    .from("campaign_contacts")
    .upsert(campaignContacts, { onConflict: "campaign_id,contact_id" });

  if (insertErr) throw insertErr;

  // Retrieve the generated campaign_contact records to get their IDs
  const { data: queuedJobs, error: fetchJobsErr } = await supabaseAdmin
    .from("campaign_contacts")
    .select("id, contact_id")
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  if (fetchJobsErr || !queuedJobs) throw new Error("Failed to initialize queue items.");

  // Dispatch QStash jobs with calculated delay batches
  const batchSize = campaign.emails_per_batch || 100;
  const delayBetweenBatches = campaign.delay_between_batches || 60; // in seconds

  await logCampaignActivity(campaignId, "info", `Dispatching workers (Batch size: ${batchSize}, Delay: ${delayBetweenBatches}s).`);

  // Publish to QStash in batches
  for (let i = 0; i < queuedJobs.length; i++) {
    const job = queuedJobs[i];
    const batchIndex = Math.floor(i / batchSize);
    const delaySeconds = batchIndex * delayBetweenBatches;

    try {
      const qstashMsgId = await publishQueueJob({
        campaignContactId: job.id,
        delaySeconds,
      });

      // Update QStash message ID in campaign_contacts
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ qstash_msg_id: qstashMsgId })
        .eq("id", job.id);
    } catch (publishErr: any) {
      console.error(`Failed to publish job index ${i} to QStash:`, publishErr);
      // Mark as failed locally immediately if publishing fails
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "failed", error_message: `QStash scheduling failed: ${publishErr.message}` })
        .eq("id", job.id);
    }
  }

  await logCampaignActivity(campaignId, "info", `Queue successfully generated. Delivery is in progress.`);
}

// 12. PAUSE CAMPAIGN
export async function pauseCampaign(campaignId: string): Promise<void> {
  await updateCampaign(campaignId, { status: "paused" });
  await logCampaignActivity(campaignId, "warn", "Campaign has been paused. Active queue dispatches will be skipped.");
}

// 13. RESUME CAMPAIGN
export async function resumeCampaign(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign || campaign.status !== "paused") return;

  // Set status back to sending
  await updateCampaign(campaignId, { status: "sending" });
  await logCampaignActivity(campaignId, "info", "Resuming campaign queue. Re-scheduling skipped items...");

  // Fetch remaining queued jobs
  const { data: queuedJobs, error } = await supabaseAdmin
    .from("campaign_contacts")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  if (error) throw error;

  if (!queuedJobs || queuedJobs.length === 0) {
    // If no jobs left in queued state, campaign is actually done
    await updateCampaign(campaignId, { status: "completed" });
    await logCampaignActivity(campaignId, "info", "Campaign marked as completed (no remaining queued items).");
    return;
  }

  // Re-dispatch remaining items
  const batchSize = campaign.emails_per_batch || 100;
  const delayBetweenBatches = campaign.delay_between_batches || 60;

  for (let i = 0; i < queuedJobs.length; i++) {
    const job = queuedJobs[i];
    const batchIndex = Math.floor(i / batchSize);
    const delaySeconds = batchIndex * delayBetweenBatches;

    try {
      const qstashMsgId = await publishQueueJob({
        campaignContactId: job.id,
        delaySeconds,
      });

      await supabaseAdmin
        .from("campaign_contacts")
        .update({ qstash_msg_id: qstashMsgId, error_message: null })
        .eq("id", job.id);
    } catch (publishErr: any) {
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "failed", error_message: `QStash scheduling failed on resume: ${publishErr.message}` })
        .eq("id", job.id);
    }
  }

  await logCampaignActivity(campaignId, "info", `Resume complete. Re-scheduled ${queuedJobs.length} items.`);
}

// 14. CANCEL CAMPAIGN
export async function cancelCampaign(campaignId: string): Promise<void> {
  await updateCampaign(campaignId, { status: "cancelled" });
  await logCampaignActivity(campaignId, "warn", "Campaign cancelled. All pending queue runs will be rejected.");
}

// 15. RETRY FAILED JOBS
export async function retryFailedCampaignJobs(campaignId: string): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  // Fetch failed items
  const { data: failedJobs, error } = await supabaseAdmin
    .from("campaign_contacts")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "failed");

  if (error) throw error;
  if (!failedJobs || failedJobs.length === 0) {
    throw new Error("No failed delivery jobs found for this campaign.");
  }

  await logCampaignActivity(campaignId, "info", `Retrying ${failedJobs.length} failed email dispatches.`);

  // Reset status to queued
  const ids = failedJobs.map((j) => j.id);
  await supabaseAdmin
    .from("campaign_contacts")
    .update({ status: "queued", error_message: null })
    .in("id", ids);

  // Set campaign status back to sending if it wasn't
  if (campaign.status !== "sending") {
    await updateCampaign(campaignId, { status: "sending" });
  }

  // Re-dispatch
  const batchSize = campaign.emails_per_batch || 100;
  const delayBetweenBatches = campaign.delay_between_batches || 60;

  for (let i = 0; i < failedJobs.length; i++) {
    const job = failedJobs[i];
    const batchIndex = Math.floor(i / batchSize);
    const delaySeconds = batchIndex * delayBetweenBatches;

    try {
      const qstashMsgId = await publishQueueJob({
        campaignContactId: job.id,
        delaySeconds,
      });

      await supabaseAdmin
        .from("campaign_contacts")
        .update({ qstash_msg_id: qstashMsgId })
        .eq("id", job.id);
    } catch (publishErr: any) {
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "failed", error_message: `QStash scheduling failed on retry: ${publishErr.message}` })
        .eq("id", job.id);
    }
  }

  await logCampaignActivity(campaignId, "info", `Retry queued. Dispatched ${failedJobs.length} failed jobs.`);
}

// 16. START PASTED RECIPIENTS CAMPAIGN
export async function startPastedCampaign(campaignId: string, contactIds: string[]): Promise<void> {
  const campaign = await getCampaign(campaignId);
  if (!campaign) throw new Error("Campaign not found");

  // Set status to sending immediately
  await updateCampaign(campaignId, { status: "sending", sent_at: new Date().toISOString() });
  await logCampaignActivity(campaignId, "info", `Initializing queue for ${contactIds.length} pasted recipients.`);

  // Create queue records in bulk
  const campaignContacts = contactIds.map((cId) => ({
    campaign_id: campaignId,
    contact_id: cId,
    status: "queued",
  }));

  const { error: insertErr } = await supabaseAdmin
    .from("campaign_contacts")
    .upsert(campaignContacts, { onConflict: "campaign_id,contact_id" });

  if (insertErr) throw insertErr;

  // Retrieve the generated campaign_contact records to get their IDs
  const { data: queuedJobs, error: fetchJobsErr } = await supabaseAdmin
    .from("campaign_contacts")
    .select("id")
    .eq("campaign_id", campaignId)
    .eq("status", "queued");

  if (fetchJobsErr || !queuedJobs) throw new Error("Failed to initialize queue items.");

  // Dispatch QStash jobs with calculated delay batches
  const batchSize = campaign.emails_per_batch || 100;
  const delayBetweenBatches = campaign.delay_between_batches || 60; // in seconds

  await logCampaignActivity(campaignId, "info", `Dispatching workers (Batch size: ${batchSize}, Delay: ${delayBetweenBatches}s).`);

  // Publish to QStash in batches
  for (let i = 0; i < queuedJobs.length; i++) {
    const job = queuedJobs[i];
    const batchIndex = Math.floor(i / batchSize);
    const delaySeconds = batchIndex * delayBetweenBatches;

    try {
      const qstashMsgId = await publishQueueJob({
        campaignContactId: job.id,
        delaySeconds,
      });

      // Update QStash message ID in campaign_contacts
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ qstash_msg_id: qstashMsgId })
        .eq("id", job.id);
    } catch (publishErr: any) {
      console.error(`Failed to publish job index ${i} to QStash:`, publishErr);
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "failed", error_message: `QStash scheduling failed: ${publishErr.message}` })
        .eq("id", job.id);
    }
  }

  await logCampaignActivity(campaignId, "info", `Queue successfully generated. Delivery in progress.`);
}

