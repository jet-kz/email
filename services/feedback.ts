import { supabaseAdmin } from "@/lib/supabase";

export interface FeedbackData {
  successfulDeliveries: {
    id: string;
    email: string;
    campaignName: string;
    sentAt: string;
  }[];
  failedDeliveries: {
    id: string;
    email: string;
    campaignName: string;
    errorMessage: string;
    failedAt: string;
  }[];
  bounceEvents: {
    id: string;
    email: string;
    campaignName: string;
    bouncedAt: string;
    reason?: string;
  }[];
  systemErrors: {
    id: string;
    campaignName: string;
    message: string;
    occurredAt: string;
  }[];
}

export async function getFeedbackMetrics(): Promise<FeedbackData> {
  try {
    // 1. Successful deliveries (Sent status)
    const { data: sentData } = await supabaseAdmin
      .from("campaign_contacts")
      .select(`
        id,
        sent_at,
        contacts (email),
        campaigns (name)
      `)
      .eq("status", "sent")
      .order("sent_at", { ascending: false })
      .limit(100);

    // 2. Failed deliveries
    const { data: failedData } = await supabaseAdmin
      .from("campaign_contacts")
      .select(`
        id,
        updated_at,
        error_message,
        contacts (email),
        campaigns (name)
      `)
      .in("status", ["failed", "bounced"])
      .order("updated_at", { ascending: false })
      .limit(100);

    // 3. Bounce events
    const { data: bounceData } = await supabaseAdmin
      .from("email_events")
      .select(`
        id,
        created_at,
        metadata,
        contacts (email),
        campaigns (name)
      `)
      .eq("event_type", "bounce")
      .order("created_at", { ascending: false })
      .limit(100);

    // 4. System log errors
    const { data: errorLogs } = await supabaseAdmin
      .from("campaign_logs")
      .select(`
        id,
        created_at,
        message,
        campaigns (name)
      `)
      .eq("log_level", "error")
      .order("created_at", { ascending: false })
      .limit(100);

    // Format outputs safely
    return {
      successfulDeliveries: (sentData || []).map((row: any) => ({
        id: row.id,
        email: row.contacts?.email || "unknown",
        campaignName: row.campaigns?.name || "Broadcast",
        sentAt: row.sent_at || new Date().toISOString(),
      })),
      failedDeliveries: (failedData || []).map((row: any) => ({
        id: row.id,
        email: row.contacts?.email || "unknown",
        campaignName: row.campaigns?.name || "Broadcast",
        errorMessage: row.error_message || "Delivery timeout",
        failedAt: row.updated_at || new Date().toISOString(),
      })),
      bounceEvents: (bounceData || []).map((row: any) => ({
        id: row.id,
        email: row.contacts?.email || "unknown",
        campaignName: row.campaigns?.name || "Broadcast",
        bouncedAt: row.created_at || new Date().toISOString(),
        reason: row.metadata?.bounce_type || row.metadata?.description || "Hard bounce",
      })),
      systemErrors: (errorLogs || []).map((row: any) => ({
        id: row.id,
        campaignName: row.campaigns?.name || "System",
        message: row.message,
        occurredAt: row.created_at || new Date().toISOString(),
      })),
    };
  } catch (err) {
    console.error("Failed to gather feedback logs:", err);
    return {
      successfulDeliveries: [],
      failedDeliveries: [],
      bounceEvents: [],
      systemErrors: [],
    };
  }
}
