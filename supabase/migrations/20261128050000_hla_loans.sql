-- HLA loan list: every Vesta loan that belongs to HomeLoanAgents, so the Vesta webhook
-- receiver can tell an HLA loan from any other loan with one fast lookup, and never has
-- to call Vesta per webhook. Filled from the HLA pipeline view (every 15 minutes and on
-- page loads), and later by the Borrower Portal when it creates a loan.
-- Access: service role only (RLS enabled, no policies), same as call_leads.

create table if not exists public.hla_loans (
  vesta_loan_id text not null,
  vesta_env text not null default 'beta' check (vesta_env in ('beta','prod')),
  loan_number text,
  -- 'pipeline-sync' or 'portal'
  source text not null default 'pipeline-sync',
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key (vesta_env, vesta_loan_id)
);

create index if not exists hla_loans_number_idx on public.hla_loans (vesta_env, loan_number);

alter table public.hla_loans enable row level security;

comment on table public.hla_loans is
  'HLA Loan Manager: Vesta loans that belong to HomeLoanAgents. The webhook receiver only accepts events for these.';

-- Vesta webhook events for HLA loans (other loans are dropped and not stored).
-- The id is Vesta''s event id, so a retried event is stored once.
create table if not exists public.vesta_webhook_events (
  id text primary key,
  vesta_env text not null default 'beta' check (vesta_env in ('beta','prod')),
  loan_id text not null,
  event_type text,
  change text,
  path text,
  event_at timestamptz,
  payload jsonb not null,
  received_at timestamptz not null default now(),
  -- Set once a bot has looked at the event.
  processed_at timestamptz
);

create index if not exists vesta_webhook_events_loan_idx on public.vesta_webhook_events (loan_id, received_at desc);
create index if not exists vesta_webhook_events_todo_idx on public.vesta_webhook_events (received_at) where processed_at is null;

alter table public.vesta_webhook_events enable row level security;

comment on table public.vesta_webhook_events is
  'HLA Loan Manager: Vesta webhook events for HLA loans, for the bots to act on.';
