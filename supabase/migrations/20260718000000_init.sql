-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- 1. SETTINGS / CONFIGURATION
create table if not exists public.settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade unique,
  sender_name text,
  sender_email text,
  reply_to_email text,
  openai_api_key text,
  resend_api_key text,
  timezone text default 'UTC',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. TAGS
create table if not exists public.tags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  color text default '#6366f1',
  created_at timestamptz default now(),
  unique(user_id, name)
);

-- 3. CONTACTS
create table if not exists public.contacts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  first_name text not null,
  last_name text not null,
  email text not null,
  company text,
  phone text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Contact-Tags link table
create table if not exists public.contact_tags (
  contact_id uuid references public.contacts(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (contact_id, tag_id)
);

-- Index for duplicate email searches
create index if not exists contacts_user_email_idx on public.contacts(user_id, email);

-- 4. CAMPAIGNS
create table if not exists public.campaigns (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  preview_text text,
  content text, -- html or json editor state
  status text not null default 'draft', -- draft, scheduled, sending, paused, completed, cancelled
  scheduled_at timestamptz,
  sent_at timestamptz,
  emails_per_batch integer default 100,
  delay_between_batches integer default 60, -- in seconds
  max_retries integer default 3,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Campaign-Tags link table
create table if not exists public.campaign_tags (
  campaign_id uuid references public.campaigns(id) on delete cascade,
  tag_id uuid references public.tags(id) on delete cascade,
  primary key (campaign_id, tag_id)
);

-- 5. CAMPAIGN_CONTACTS (QUEUE JOBS)
create table if not exists public.campaign_contacts (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  status text not null default 'queued', -- queued, sending, sent, failed, bounced, unsubscribed
  qstash_msg_id text, -- stored when scheduled in QStash
  resend_email_id text, -- stored on Resend dispatch
  error_message text,
  sent_at timestamptz,
  opened_at timestamptz,
  clicked_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(campaign_id, contact_id)
);

-- Index for queue lookup
create index if not exists campaign_contacts_queue_idx on public.campaign_contacts(campaign_id, status);

-- 6. EMAIL_EVENTS
create table if not exists public.email_events (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  contact_id uuid references public.contacts(id) on delete cascade,
  event_type text not null, -- sent, delivered, open, click, bounce, unsubscribe
  metadata jsonb,
  created_at timestamptz default now()
);

-- 7. TEMPLATES
create table if not exists public.templates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade,
  name text not null,
  subject text,
  content text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 8. CAMPAIGN_LOGS
create table if not exists public.campaign_logs (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid references public.campaigns(id) on delete cascade,
  log_level text not null default 'info', -- info, warn, error
  message text not null,
  created_at timestamptz default now()
);
