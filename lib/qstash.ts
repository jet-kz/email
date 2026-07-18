import { Client } from "@upstash/qstash";
import { getSettings } from "@/services/settings";

let qstashClient: Client | null = null;

export async function getQStashClient(): Promise<Client> {
  if (qstashClient) return qstashClient;

  const settings = await getSettings();
  // Fetch from DB settings or fall back to system environment variables
  const token = process.env.QSTASH_TOKEN;
  
  if (!token) {
    throw new Error("Upstash QStash Token is not configured. Please set the QSTASH_TOKEN environment variable.");
  }

  qstashClient = new Client({ token });
  return qstashClient;
}

interface PublishJobParams {
  campaignContactId: string;
  delaySeconds: number;
}

export async function publishQueueJob({ campaignContactId, delaySeconds }: PublishJobParams): Promise<string> {
  const client = await getQStashClient();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const endpoint = `${baseUrl}/api/queue/qstash-worker`;

  // Upstash-Delay header accepts duration strings like "10s", "1m", "2h", etc.
  const delayHeader = delaySeconds > 0 ? `${delaySeconds}s` : undefined;

  const response = await client.publishJSON({
    url: endpoint,
    body: { campaignContactId },
    headers: delayHeader ? { "Upstash-Delay": delayHeader } : {},
    retries: 3, // Auto retry 3 times on connection issues
  });

  return (response as any).messageId;
}
