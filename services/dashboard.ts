import { supabaseAdmin } from "@/lib/supabase";
import { DashboardStats } from "@/types";

const DEFAULT_USER_ID = "00000000-0000-0000-0000-000000000000";

async function getActiveUserId(): Promise<string> {
  const { data: { user } } = await supabaseAdmin.auth.getUser().catch(() => ({ data: { user: null } }));
  return user?.id || DEFAULT_USER_ID;
}

export async function getDashboardStats(): Promise<DashboardStats> {
  const userId = await getActiveUserId();

  try {
    // 1. Total Contacts Count
    const { count: totalContacts } = await supabaseAdmin
      .from("contacts")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    // 2. Campaigns Counts
    const { count: totalCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId);

    const { count: activeCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "sending");

    const { count: scheduledCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("user_id", userId)
      .eq("status", "scheduled");

    // 3. Emails Sent / Failed aggregation across all user campaigns
    // Fetch campaign ids belonging to user
    const { data: userCampaigns } = await supabaseAdmin
      .from("campaigns")
      .select("id")
      .eq("user_id", userId);

    const campaignIds = (userCampaigns || []).map(c => c.id);

    let emailsSent = 0;
    let failedEmails = 0;

    if (campaignIds.length > 0) {
      const { count: sentCount } = await supabaseAdmin
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", campaignIds)
        .eq("status", "sent");
      
      const { count: failedCount } = await supabaseAdmin
        .from("campaign_contacts")
        .select("*", { count: "exact", head: true })
        .in("campaign_id", campaignIds)
        .in("status", ["failed", "bounced"]);

      emailsSent = sentCount || 0;
      failedEmails = failedCount || 0;
    }

    const totalTries = emailsSent + failedEmails;
    const deliveryRate = totalTries > 0 ? (emailsSent / totalTries) * 100 : 100;

    // 4. Fetch recent campaigns with their individual stats
    const { data: recentCamps } = await supabaseAdmin
      .from("campaigns")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(5);

    const recentCampaignsWithStats = [];

    if (recentCamps) {
      for (const campaign of recentCamps) {
        const { data: jobs } = await supabaseAdmin
          .from("campaign_contacts")
          .select("status")
          .eq("campaign_id", campaign.id);

        const stats = { queued: 0, sending: 0, sent: 0, failed: 0, bounced: 0, unsubscribed: 0 };
        if (jobs) {
          jobs.forEach(j => {
            const k = j.status as keyof typeof stats;
            if (stats[k] !== undefined) stats[k]++;
          });
        }

        recentCampaignsWithStats.push({
          ...campaign,
          stats,
        });
      }
    }

    return {
      totalContacts: totalContacts || 0,
      totalCampaigns: totalCampaigns || 0,
      emailsSent,
      failedEmails,
      scheduledCampaigns: scheduledCampaigns || 0,
      activeCampaigns: activeCampaigns || 0,
      deliveryRate,
      recentCampaigns: recentCampaignsWithStats,
    };
  } catch (err) {
    console.error("Dashboard Stats calculation failed:", err);
    return {
      totalContacts: 0,
      totalCampaigns: 0,
      emailsSent: 0,
      failedEmails: 0,
      scheduledCampaigns: 0,
      activeCampaigns: 0,
      deliveryRate: 100,
      recentCampaigns: [],
    };
  }
}
