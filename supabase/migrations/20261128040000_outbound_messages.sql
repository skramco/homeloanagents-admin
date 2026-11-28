-- Bot-drafted borrower messages and the person's decision on each.
-- One row per draft, written when someone approves, edits or rejects it.
-- The id is the draft's own id (e.g. daily-<loan>-<date>), so a draft can only be
-- reviewed once and an approved message can only be sent once.
-- Access: service role only (RLS enabled, no policies), same as call_leads.

create table if not exists public.outbound_messages (
  id text primary key,
  loan_ref text,
  vesta_env text not null default 'beta' check (vesta_env in ('beta','prod')),
  task_type text not null,
  bot text not null,
  channel text not null check (channel in ('email','sms')),
  to_address text,
  subject text,
  -- As the bot wrote it, and as the reviewer approved it.
  draft_body text not null,
  final_body text,
  monitor text not null check (monitor in ('passed','flagged','blocked')),
  monitor_note text,
  outcome text not null check (outcome in ('approved','edited','rejected')),
  reviewed_by text not null,
  reviewed_at timestamptz not null default now(),
  reject_reason text,
  -- Sending. 'held' = approved while sending is switched off.
  send_status text not null default 'held' check (send_status in ('held','sending','sent','failed','not_sending')),
  provider text,
  provider_message_id text,
  sent_at timestamptz,
  send_error text,
  -- The inbound email or text a support reply answers (ids, thread, sender).
  in_reply_to jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists outbound_messages_task_idx on public.outbound_messages (task_type, reviewed_at desc);
create index if not exists outbound_messages_loan_idx on public.outbound_messages (loan_ref, reviewed_at desc);

alter table public.outbound_messages enable row level security;

comment on table public.outbound_messages is
  'HLA Loan Manager: bot drafts and review decisions (approve/edit/reject), plus send status. Written by the admin app (service role).';
