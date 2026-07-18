"use server"

import { Client } from "@upstash/qstash";

// Validate QStash Token
if (!process.env.QSTASH_TOKEN && process.env.NODE_ENV === "production") {
    console.warn("QSTASH_TOKEN is absolutely required for dispatching queue jobs.");
}

const qstashClient = new Client({ token: process.env.QSTASH_TOKEN || "DUMMY_TOKEN" });

export async function sendBulkEmails(emails: string[], subject: string, body: string, replyTo?: string) {
  try {
    // Generate valid App URL for the webhook
    const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
    const queueEndpoint = `${APP_URL}/api/queue/worker`;

    // Process all emails and publish them into individual delayed jobs to Upstash QStash
    const publishPromises = emails.map((email, index) => {
      // Stagger sending: Every 5 seconds an email is dispatched via QStash to avoid getting marked as spam instantly
      const delayInSeconds = index * 5; 
      
      const req: any = {
        url: queueEndpoint,
        body: { email, subject, body, replyTo }
      };
      if (delayInSeconds > 0) {
        req.delay = `${delayInSeconds}s`;
      }
      
      return qstashClient.publishJSON(req);
    });

    // Await all publishes
    await Promise.all(publishPromises);

    return { success: true };
  } catch (error: any) {
    console.error("Bulk queue error:", error);
    return { success: false, error: error.message || "Unknown queue error" };
  }
}
