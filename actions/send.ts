"use server"

import { Client } from "@upstash/qstash";
import Groq from "groq-sdk";

// Initialize Groq client
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// Helper to use AI to automatically add spintax to raw text
async function generateSpintax(text: string, type: "subject" | "body"): Promise<string> {
  // Gracefully fallback to raw text if no API key is provided
  if (!process.env.GROQ_API_KEY) return text; 
  
  try {
    const prompt = `Rewrite the following email ${type} into a "spintax" format. 
Spintax allows random variations to bypass identical-content spam filters.
Find multiple key words or short phrases in the text and replace them with a spin block like {option1|option2|option3}.
Make sure you create at least 4 different spin blocks.
Do NOT change the overall meaning of the text. Do NOT add any extra commentary. Just return the valid spintax string.

Original text:
${text}`;

    const response = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.7,
    });
    
    return response.choices[0]?.message?.content?.trim() || text;
  } catch (error) {
    console.error("Groq Spintax generation failed:", error);
    return text;
  }
}
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

    // Automatically convert plain text to Spintax using Groq!
    const aiSubject = await generateSpintax(subject, "subject");
    const aiBody = await generateSpintax(body, "body");

    // Process all emails and publish them into individual delayed jobs to Upstash QStash
    const publishPromises = emails.map((email, index) => {
      // Stagger sending: Every 5 seconds an email is dispatched via QStash to avoid getting marked as spam instantly
      const delayInSeconds = index * 5; 
      
      const req: any = {
        url: queueEndpoint,
        body: { email, subject: aiSubject, body: aiBody, replyTo }
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
