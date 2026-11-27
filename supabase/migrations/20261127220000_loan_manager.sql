-- HLA Loan Manager core tables.
-- loan_files: one row per borrower file, linking the voice-agent lead, the
--   homeloanagents.com portal user and the Vesta loan.
-- events: append-only audit log. Every bot message, call, monitor result,
--   approval and human action. Feeds timelines, queues and KPIs.
-- Access: service role only (RLS enabled, no policies), same as call_leads.

create table if not exists public.loan_files (
  id uuid primary key default gen_random_uuid(),
  call_lead_id uuid references public.call_leads (id) on delete set null,
  portal_user_id text,
  vesta_loan_number text unique,
  borrower_name text,
  phone text,
  email text,
  state text check (state is null or char_length(state) = 2),
  purpose text,
  loan_amount numeric(12, 2),
  program text,
  stage text not null default 'lead'
    check (stage in ('lead','portal_account','application','quote_lock','disclosures','processing','underwriting','closing','funded','withdrawn','denied')),
  owner_role text check (owner_role in ('mark','processor_1','processor_2','lorinn')),
  -- Consent ledger (latest state; the history lives in events).
  consent_ai_disclosure_at timestamptz,
  consent_tcpa_at timestamptz,
  consent_esign_at timestamptz,
  consent_recording_at timestamptz,
  do_not_call boolean not null default false,
  lock_rate numeric(6, 3),
  lock_expires_on date,
  closing_on date,
  le_due_on date,
  cd_due_on date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists loan_files_stage_idx on public.loan_files (stage);
create index if not exists loan_files_phone_idx on public.loan_files (phone) where phone is not null;
create index if not exists loan_files_email_idx on public.loan_files (email) where email is not null;

create table if not exists public.events (
  id bigint generated always as identity primary key,
  loan_file_id uuid references public.loan_files (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  -- 'bot' | 'person' | 'system' | 'borrower'
  actor_type text not null check (actor_type in ('bot','person','system','borrower')),
  -- bot name (e.g. 'Concierge') or person role (e.g. 'mark')
  actor text not null,
  prompt_version text,
  -- e.g. 'message.drafted', 'message.sent', 'monitor.blocked', 'approval.requested',
  -- 'approval.granted', 'escalation.opened', 'call.completed', 'consent.captured'
  kind text not null,
  channel text check (channel is null or channel in ('voice','sms','email','portal','internal')),
  summary text not null,
  payload jsonb not null default '{}'::jsonb
);

create index if not exists events_loan_idx on public.events (loan_file_id, occurred_at desc);
create index if not exists events_kind_idx on public.events (kind, occurred_at desc);

-- Append-only: block updates and deletes, even for the service role.
create or replace function public.events_append_only() returns trigger
language plpgsql as $$
begin
  raise exception 'events is append-only';
end;
$$;

drop trigger if exists events_no_update on public.events;
create trigger events_no_update before update or delete on public.events
  for each row execute function public.events_append_only();

alter table public.loan_files enable row level security;
alter table public.events enable row level security;

comment on table public.loan_files is 'HLA Loan Manager: one row per borrower file across voice agent, portal and Vesta.';
comment on table public.events is 'HLA Loan Manager: append-only audit log of every bot and human action.';
