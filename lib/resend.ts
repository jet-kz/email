import { Resend } from "resend";
import { getSettings } from "@/services/settings";

let resendClient: Resend | null = null;

export async function getResendClient(): Promise<Resend> {
  const settings = await getSettings();
  const apiKey = settings.resend_api_key || process.env.RESEND_API_KEY;

  if (!apiKey) {
    throw new Error("Resend API key is missing. Please configure it in Settings.");
  }

  // Create client on the fly to support dynamic key updates
  return new Resend(apiKey);
}

interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  senderName?: string;
  senderEmail?: string;
  replyToEmail?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  senderName,
  senderEmail,
  replyToEmail,
}: SendEmailParams) {
  const resend = await getResendClient();
  const settings = await getSettings();

  const name = senderName || settings.sender_name || "Antigravity AI Platform";
  const email = senderEmail || settings.sender_email;
  const replyTo = replyToEmail || settings.reply_to_email || undefined;

  if (!email) {
    throw new Error("Sender Email Address is not configured. Please add it in settings.");
  }

  const from = `${name} <${email}>`;

  const { data, error } = await resend.emails.send({
    from,
    to: [to],
    subject,
    html,
    replyTo: replyTo ? [replyTo] : undefined,
  });

  if (error) {
    console.error("Resend API returned error:", error);
    throw new Error(error.message);
  }

  return data;
}
