import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase";
import { logCampaignActivity } from "@/services/campaigns";

export async function POST(req: NextRequest) {
  try {
    const payload = await req.json();
    const { type, data } = payload;

    if (!data || !data.email_id) {
      return NextResponse.json({ error: "Missing webhook email identifier" }, { status: 400 });
    }

    const resendEmailId = data.email_id;

    // Look up the campaign contact by resend_email_id
    const { data: campaignContact, error: fetchError } = await supabaseAdmin
      .from("campaign_contacts")
      .select("id, campaign_id, contact_id, status")
      .eq("resend_email_id", resendEmailId)
      .maybeSingle();

    if (fetchError || !campaignContact) {
      console.warn(`Resend Webhook: No campaign contact found matching resend_email_id: ${resendEmailId}`);
      return NextResponse.json({ status: "ignored_unrecognized_id" }, { status: 200 });
    }

    let statusUpdate = "";
    let logMessage = "";

    // Map Resend events to campaign contact status
    switch (type) {
      case "email.delivered":
        // Only update if not already set to something more specific
        if (campaignContact.status !== "unsubscribed" && campaignContact.status !== "bounced") {
          statusUpdate = "sent";
        }
        logMessage = `Email delivered to recipient.`;
        break;
      case "email.bounced":
        statusUpdate = "bounced";
        logMessage = `Email bounced. Delivery refused by receiving server.`;
        break;
      case "email.opened":
        // Update opened_at timestamp
        await supabaseAdmin
          .from("campaign_contacts")
          .update({ opened_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", campaignContact.id);
        logMessage = `Recipient opened the email.`;
        break;
      case "email.clicked":
        // Update clicked_at timestamp
        await supabaseAdmin
          .from("campaign_contacts")
          .update({ clicked_at: new Date().toISOString(), updated_at: new Date().toISOString() })
          .eq("id", campaignContact.id);
        logMessage = `Recipient clicked a link inside the email.`;
        break;
      case "email.unsubscribed":
        statusUpdate = "unsubscribed";
        logMessage = `Recipient unsubscribed from this campaign list.`;
        
        // Also add logic to suppress this contact's email or flag it?
        // In a full system, we could set a flag on the contacts table.
        // Let's also log notes on the contact
        await supabaseAdmin
          .from("contacts")
          .update({ notes: `Unsubscribed via campaign ${campaignContact.campaign_id} on ${new Date().toLocaleDateString()}` })
          .eq("id", campaignContact.contact_id);
        break;
      default:
        console.log(`Resend Webhook: Ignored event type: ${type}`);
        return NextResponse.json({ status: "ignored_unhandled_type" }, { status: 200 });
    }

    // Update status in campaign_contacts if mapped
    if (statusUpdate) {
      await supabaseAdmin
        .from("campaign_contacts")
        .update({ status: statusUpdate, updated_at: new Date().toISOString() })
        .eq("id", campaignContact.id);
    }

    // Insert to email_events
    await supabaseAdmin.from("email_events").insert({
      campaign_id: campaignContact.campaign_id,
      contact_id: campaignContact.contact_id,
      event_type: type.replace("email.", ""),
      metadata: data,
    });

    // Log to campaign activity logs
    await logCampaignActivity(
      campaignContact.campaign_id,
      type === "email.bounced" ? "warn" : "info",
      `Event [${type.replace("email.", "")}]: ${logMessage} (Recipient: ${data.to?.[0] || "unknown"})`
    );

    return NextResponse.json({ status: "processed" }, { status: 200 });
  } catch (err: any) {
    console.error("Critical Resend Webhook error:", err);
    return NextResponse.json({ error: err.message || "Internal server error" }, { status: 500 });
  }
}
