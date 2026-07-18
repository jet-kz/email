import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { supabaseAdmin } from "@/lib/supabase";
import { sendEmail } from "@/lib/resend";
import { interpolate } from "@/utils/personalization";
import { logCampaignActivity } from "@/services/campaigns";

// Initialize QStash signature receiver
const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY || "";
const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY || "";
const receiver = currentKey ? new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey }) : null;

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // 1. Signature Verification
    if (receiver) {
      const signature = req.headers.get("upstash-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing QStash signature header" }, { status: 401 });
      }

      const isValid = await receiver.verify({
        signature,
        body: rawBody,
      }).catch(() => false);

      if (!isValid) {
        return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
      }
    } else {
      console.warn("QStash signature verification skipped (keys not configured in .env). Only use in development.");
    }

    // 2. Parse payload
    const { campaignContactId } = JSON.parse(rawBody);
    if (!campaignContactId) {
      return NextResponse.json({ error: "Missing campaignContactId parameter" }, { status: 400 });
    }

    // 3. Fetch campaign contact details along with contact and campaign
    const { data: job, error: jobError } = await supabaseAdmin
      .from("campaign_contacts")
      .select(`
        *,
        contacts (*),
        campaigns (*)
      `)
      .eq("id", campaignContactId)
      .maybeSingle();

    if (jobError || !job) {
      return NextResponse.json({ error: "Queue job not found" }, { status: 404 });
    }

    const { contacts: contact, campaigns: campaign } = job as any;
    if (!contact || !campaign) {
      return NextResponse.json({ error: "Associated contact or campaign records not found" }, { status: 404 });
    }

    // 4. Handle Pause and Cancel status
    if (campaign.status === "paused") {
      // Re-queue the contact (keep it in queued state) so that it can be picked up on resume
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "queued", error_message: "Skipped: Campaign was paused" })
        .eq("id", campaignContactId);
      
      await logCampaignActivity(campaign.id, "info", `Paused: Skipped sending to ${contact.email} (held in queue).`);
      return NextResponse.json({ status: "skipped_paused" }, { status: 200 });
    }

    if (campaign.status === "cancelled" || campaign.status === "archived") {
      // Mark job as failed/cancelled
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: "failed", error_message: "Cancelled: Campaign aborted by administrator" })
        .eq("id", campaignContactId);
        
      await logCampaignActivity(campaign.id, "warn", `Cancelled: Skipped sending to ${contact.email}.`);
      return NextResponse.json({ status: "skipped_cancelled" }, { status: 200 });
    }

    // 5. Check if already sent
    if (job.status === "sent") {
      return NextResponse.json({ status: "already_sent" }, { status: 200 });
    }

    // 6. Set state to sending
    await supabaseAdmin
      .from("campaign_contacts")
      .update({ status: "sending", updated_at: new Date().toISOString() })
      .eq("id", campaignContactId);

    // 7. Interpolate template fields
    const personalSubject = interpolate(campaign.subject, contact);
    const personalContent = interpolate(campaign.content, contact);

    // 8. Trigger Email Delivery
    try {
      const resendResult = await sendEmail({
        to: contact.email,
        subject: personalSubject,
        html: personalContent,
      });

      // Update state to sent
      await supabaseAdmin
        .from("campaign_contacts")
        .update({
          status: "sent",
          sent_at: new Date().toISOString(),
          resend_email_id: resendResult?.id || null,
          error_message: null,
          updated_at: new Date().toISOString()
        })
        .eq("id", campaignContactId);

      // Create an event log
      await supabaseAdmin.from("email_events").insert({
        campaign_id: campaign.id,
        contact_id: contact.id,
        event_type: "sent",
      });

      return NextResponse.json({ status: "success" }, { status: 200 });
    } catch (sendErr: any) {
      // 9. Error and Retry Handling
      const qstashRetriesHeader = req.headers.get("upstash-retries") || "0";
      const currentRetries = parseInt(qstashRetriesHeader, 10);
      const maxRetries = campaign.max_retries ?? 3;

      console.error(`Resend send error (Attempt ${currentRetries + 1}/${maxRetries}):`, sendErr);

      if (currentRetries >= maxRetries) {
        // Exceeded retries, fail the job
        await supabaseAdmin
          .from("campaign_contacts")
          .update({
            status: "failed",
            error_message: `Delivery failed after ${maxRetries} retries: ${sendErr.message}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", campaignContactId);

        await logCampaignActivity(
          campaign.id,
          "error",
          `Delivery failure to ${contact.email}: ${sendErr.message}`
        );

        return NextResponse.json({ status: "failed_permanently", error: sendErr.message }, { status: 200 });
      } else {
        // Update database with intermediate error and return 500 for QStash retry
        await supabaseAdmin
          .from("campaign_contacts")
          .update({
            status: "failed", // Set status failed, but will be overwritten if QStash retry succeeds
            error_message: `Attempt ${currentRetries + 1} failed: ${sendErr.message}`,
            updated_at: new Date().toISOString()
          })
          .eq("id", campaignContactId);

        return NextResponse.json({ status: "retry_scheduled", error: sendErr.message }, { status: 500 });
      }
    }
  } catch (err: any) {
    console.error("Critical worker error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
