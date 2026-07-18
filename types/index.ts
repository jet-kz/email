export interface Settings {
  id: string;
  user_id: string;
  sender_name: string | null;
  sender_email: string | null;
  reply_to_email: string | null;
  openai_api_key: string | null;
  resend_api_key: string | null;
  timezone: string;
  created_at: string;
  updated_at: string;
}

export interface Tag {
  id: string;
  user_id: string;
  name: string;
  color: string;
  created_at: string;
}

export interface Contact {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  company: string | null;
  phone: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export type CampaignStatus = 'draft' | 'scheduled' | 'sending' | 'paused' | 'completed' | 'cancelled';

export interface Campaign {
  id: string;
  user_id: string;
  name: string;
  subject: string | null;
  preview_text: string | null;
  content: string | null;
  status: CampaignStatus;
  scheduled_at: string | null;
  sent_at: string | null;
  emails_per_batch: number;
  delay_between_batches: number; // in seconds
  max_retries: number;
  created_at: string;
  updated_at: string;
  tags?: Tag[];
}

export type CampaignContactStatus = 'queued' | 'sending' | 'sent' | 'failed' | 'bounced' | 'unsubscribed';

export interface CampaignContact {
  id: string;
  campaign_id: string;
  contact_id: string;
  status: CampaignContactStatus;
  qstash_msg_id: string | null;
  error_message: string | null;
  sent_at: string | null;
  opened_at: string | null;
  clicked_at: string | null;
  created_at: string;
  updated_at: string;
  contact?: Contact;
}

export interface EmailEvent {
  id: string;
  campaign_id: string;
  contact_id: string;
  event_type: 'sent' | 'delivered' | 'open' | 'click' | 'bounce' | 'unsubscribe';
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface Template {
  id: string;
  user_id: string;
  name: string;
  subject: string | null;
  content: string | null;
  created_at: string;
  updated_at: string;
}

export interface CampaignLog {
  id: string;
  campaign_id: string;
  log_level: 'info' | 'warn' | 'error';
  message: string;
  created_at: string;
}

export interface DashboardStats {
  totalContacts: number;
  totalCampaigns: number;
  emailsSent: number;
  failedEmails: number;
  scheduledCampaigns: number;
  activeCampaigns: number;
  deliveryRate: number;
  recentCampaigns: (Campaign & {
    stats: {
      queued: number;
      sending: number;
      sent: number;
      failed: number;
      bounced: number;
      unsubscribed: number;
    }
  })[];
}
