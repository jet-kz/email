import { NextRequest, NextResponse } from "next/server";
import { Receiver } from "@upstash/qstash";
import { Resend } from "resend";

const currentKey = process.env.QSTASH_CURRENT_SIGNING_KEY || "";
const nextKey = process.env.QSTASH_NEXT_SIGNING_KEY || "";
const receiver = currentKey ? new Receiver({ currentSigningKey: currentKey, nextSigningKey: nextKey }) : null;
const resend = new Resend(process.env.RESEND_API_KEY!);
const senderEmail = process.env.SENDER_EMAIL || "hello@yourdomain.com";

export async function POST(req: NextRequest) {
  try {
    const rawBody = await req.text();

    // 1. Signature Verification for Upstash Security
    if (receiver) {
      const signature = req.headers.get("upstash-signature");
      if (!signature) {
        return NextResponse.json({ error: "Missing QStash signature" }, { status: 401 });
      }

      const isValid = await receiver.verify({ signature, body: rawBody }).catch(() => false);
      if (!isValid) return NextResponse.json({ error: "Invalid QStash signature" }, { status: 401 });
    }

    // 2. Parse payload directly
    const { email, subject, body, replyTo } = JSON.parse(rawBody);

    if (!email || !subject || !body) {
      return NextResponse.json({ error: "Missing required payload" }, { status: 400 });
    }

    // 3. Dispatch the email individually
    const { data, error } = await resend.emails.send({
      from: senderEmail,
      to: email,
      subject,
      html: body,
      replyTo: replyTo || undefined,
    });

    if (error) {
      console.error("Resend delivery failed:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ status: "success", data }, { status: 200 });
  } catch (err: any) {
    console.error("Worker generic error:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
