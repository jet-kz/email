import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { startCampaignSending } from "@/services/campaigns";

export async function GET(req: NextRequest) {
  try {
    // 1. Authorize Cron trigger
    const cronHeader = req.headers.get("x-vercel-cron");
    const isLocalDev = process.env.NODE_ENV === "development";

    if (!cronHeader && !isLocalDev) {
      return NextResponse.json({ error: "Unauthorized access" }, { status: 401 });
    }

    // 2. Fetch scheduled campaigns ready to be sent (scheduled_at <= now)
    const now = new Date().toISOString();
    const { data: scheduledCampaigns, error } = await supabaseAdmin
      .from("campaigns")
      .select("id, name")
      .eq("status", "scheduled")
      .lte("scheduled_at", now);

    if (error) {
      console.error("Cron failed to fetch scheduled campaigns:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!scheduledCampaigns || scheduledCampaigns.length === 0) {
      return NextResponse.json({ message: "No campaigns scheduled at this time." }, { status: 200 });
    }

    console.log(`Cron: Found ${scheduledCampaigns.length} campaigns to launch.`);
    const results: string[] = [];

    // 3. Launch each campaign in parallel/sequence
    for (const campaign of scheduledCampaigns) {
      try {
        await startCampaignSending(campaign.id);
        results.push(`Successfully launched campaign: ${campaign.name} (${campaign.id})`);
      } catch (err: any) {
        console.error(`Cron: Failed to launch campaign ${campaign.id}:`, err);
        results.push(`Failed to launch campaign: ${campaign.name} (${campaign.id}) - Error: ${err.message}`);
      }
    }

    return NextResponse.json({ results }, { status: 200 });
  } catch (err: any) {
    console.error("Critical Cron scheduler error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
