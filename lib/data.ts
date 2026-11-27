// Server-side only: uses the Supabase service role key.
import { cache } from "react";
import type { Loan } from "./types";
import { loadVestaPipeline, type VestaPipelineResult } from "./vesta/pipeline";
import { getSupabaseAdmin, type CallLeadRow } from "./supabase/admin";

export function supabaseConfigured(): boolean {
  return Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

function shortDate(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date(iso));
}

function shortTime(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/Los_Angeles" }).format(new Date(iso));
}

/** Turns a real voice-agent call (call_leads row) into a Lead-stage file. */
export function callLeadToLoan(row: CallLeadRow): Loan {
  const name = row.name?.trim() || row.phone || "Unknown caller";
  return {
    id: `call-${row.id}`,
    source: "call_leads",
    name,
    state: "—",
    purpose: "Voice agent lead",
    amount: "not captured",
    program: "TBD",
    stage: 0,
    health: row.recap_sent_at ? "ok" : "attention",
    owner: "Processor 1",
    waiting: row.recap_sent_at ? "Borrower to start the application from the recap" : "Recap email not sent yet",
    bot: "Concierge",
    botNow: row.recap_sent_at ? `Recap emailed ${shortTime(row.recap_sent_at)}` : "Call saved; no recap sent",
    lastContact: `Voice agent call · ${shortTime(row.created_at)}`,
    lock: "Not quoted",
    closing: "",
    vesta: "not yet",
    trid: "No application yet",
    tridState: "muted",
    // Consent capture is not stored on call_leads yet; shown as missing until it is.
    consent: { aiDisclosure: true, tcpa: false, esign: false, recording: true },
    dates: [shortDate(row.created_at)],
    gaps: row.recap_sent_at ? [] : [0],
    conditions: [],
    callSummary: row.summary,
    phone: row.phone,
    email: row.email,
  };
}

export type LoadedLoans = {
  loans: Loan[];
  liveCount: number;
  liveError: string | null;
  vesta: VestaPipelineResult;
};

async function loadCallLeads(): Promise<{ loans: Loan[]; error: string | null }> {
  if (!supabaseConfigured()) return { loans: [], error: null };
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("call_leads")
      .select("id, call_id, phone, email, name, transcript, summary, recap_sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    return { loans: (data ?? []).map((r) => callLeadToLoan(r as CallLeadRow)), error: null };
  } catch (err) {
    return { loans: [], error: err instanceof Error ? err.message : "Unknown error" };
  }
}

/** Real voice-agent leads (newest first), then real loan files from the Vesta pipeline view. */
// cache(): the layout and the page both load loans; this makes it one Vesta call per request.
export const loadLoans = cache(async (): Promise<LoadedLoans> => {
  const [leads, vesta] = await Promise.all([loadCallLeads(), loadVestaPipeline()]);
  return { loans: [...leads.loans, ...vesta.loans], liveCount: leads.loans.length, liveError: leads.error, vesta };
});

export async function loadLoan(id: string): Promise<Loan | null> {
  const { loans } = await loadLoans();
  return loans.find((l) => l.id === id) ?? null;
}
