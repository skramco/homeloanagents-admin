// Server-side only: uses the Supabase service role key.
import type { Loan } from "./types";
import { SAMPLE_LOANS } from "./sample-data";
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

export type LoadedLoans = { loans: Loan[]; liveCount: number; liveError: string | null };

/** Real voice-agent leads (newest first) followed by the sample files. */
export async function loadLoans(): Promise<LoadedLoans> {
  if (!supabaseConfigured()) {
    return { loans: SAMPLE_LOANS, liveCount: 0, liveError: null };
  }
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("call_leads")
      .select("id, call_id, phone, email, name, transcript, summary, recap_sent_at, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) throw error;
    const live = (data ?? []).map((r) => callLeadToLoan(r as CallLeadRow));
    return { loans: [...live, ...SAMPLE_LOANS], liveCount: live.length, liveError: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { loans: SAMPLE_LOANS, liveCount: 0, liveError: message };
  }
}

export async function loadLoan(id: string): Promise<Loan | null> {
  const { loans } = await loadLoans();
  return loans.find((l) => l.id === id) ?? null;
}
