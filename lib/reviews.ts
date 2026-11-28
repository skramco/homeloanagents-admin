/**
 * Review decisions on bot drafts, saved in Supabase (public.outbound_messages).
 * If Supabase isn't set up, or the table isn't there yet, the queue falls back to
 * keeping reviews in the browser and says so.
 */

import { getSupabaseAdmin } from "./supabase/admin";
import type { ReviewOutcome, ReviewTally } from "@/components/Workspace";

export type SavedReviews = {
  available: boolean;
  /** Why reviews aren't being saved, for the banner. */
  problem: string | null;
  /** Draft id → outcome, for drafts already reviewed by anyone. */
  reviewed: Record<string, ReviewOutcome>;
  tallies: Record<string, ReviewTally>;
  /** The latest reviews, newest first, with what happened when sending. */
  recent: RecentReview[];
};

export type RecentReview = {
  id: string;
  task_type: string;
  channel: string;
  to_address: string | null;
  subject: string | null;
  outcome: string;
  reviewed_by: string;
  reviewed_at: string;
  send_status: string;
  send_error: string | null;
  sent_at: string | null;
};

const WINDOW = 50;

export const supabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function missingTable(err: { code?: string; message?: string } | null): boolean {
  return Boolean(err && (err.code === "42P01" || err.code === "PGRST205" || /outbound_messages/.test(err.message ?? "")));
}

export async function loadSavedReviews(ids: string[], recentLimit = 15): Promise<SavedReviews> {
  const none: SavedReviews = { available: false, problem: null, reviewed: {}, tallies: {}, recent: [] };
  if (!supabaseConfigured()) return { ...none, problem: "Supabase isn't set up for the admin app." };
  const db = getSupabaseAdmin();
  const recent = await db.from("outbound_messages").select("task_type, outcome").order("reviewed_at", { ascending: false }).limit(2000);
  if (recent.error) {
    return { ...none, problem: missingTable(recent.error) ? "The outbound_messages table hasn't been added to Supabase yet." : `Supabase: ${recent.error.message}` };
  }
  const tallies: Record<string, ReviewTally> = {};
  // Rows come newest first; `recent` is kept oldest → newest like the browser tally.
  for (const row of [...(recent.data ?? [])].reverse() as { task_type: string; outcome: ReviewOutcome }[]) {
    const t = (tallies[row.task_type] ??= { approved: 0, edited: 0, rejected: 0, recent: [] });
    t[row.outcome] += 1;
    t.recent.push(row.outcome);
    if (t.recent.length > WINDOW) t.recent.shift();
  }
  const reviewed: Record<string, ReviewOutcome> = {};
  for (let i = 0; i < ids.length; i += 200) {
    const r = await db.from("outbound_messages").select("id, outcome").in("id", ids.slice(i, i + 200));
    if (r.error) return { ...none, problem: `Supabase: ${r.error.message}` };
    for (const row of r.data as { id: string; outcome: ReviewOutcome }[]) reviewed[row.id] = row.outcome;
  }
  const latest = await db
    .from("outbound_messages")
    .select("id, task_type, channel, to_address, subject, outcome, reviewed_by, reviewed_at, send_status, send_error, sent_at")
    .order("reviewed_at", { ascending: false })
    .limit(recentLimit);
  return { available: true, problem: null, reviewed, tallies, recent: (latest.data ?? []) as RecentReview[] };
}

export type TaskStats = { reviewed: number; approvedAsWritten: number; sent: number; failed: number; held: number; last: string | null };
export type Activity = {
  available: boolean;
  /** Per task type, last 30 days. */
  byTask: Record<string, TaskStats>;
  /** Loan ref → when the borrower was last sent anything. */
  lastSentByLoan: Record<string, string>;
  /** Sends that failed, or approved messages held with a reason. Newest first. */
  problems: RecentReview[];
};

/** What the bots' messages did over the last 30 days, for Today and Bots. */
export async function loadActivity(): Promise<Activity> {
  const empty: Activity = { available: false, byTask: {}, lastSentByLoan: {}, problems: [] };
  if (!supabaseConfigured()) return empty;
  const since = new Date(Date.now() - 30 * 86400_000).toISOString();
  const r = await getSupabaseAdmin()
    .from("outbound_messages")
    .select("id, loan_ref, task_type, channel, to_address, subject, outcome, reviewed_by, reviewed_at, send_status, send_error, sent_at")
    .gte("reviewed_at", since)
    .order("reviewed_at", { ascending: false })
    .limit(2000);
  if (r.error) return empty;
  const rows = (r.data ?? []) as (RecentReview & { loan_ref: string | null })[];
  const byTask: Record<string, TaskStats> = {};
  const lastSentByLoan: Record<string, string> = {};
  const problems: RecentReview[] = [];
  for (const row of rows) {
    const t = (byTask[row.task_type] ??= { reviewed: 0, approvedAsWritten: 0, sent: 0, failed: 0, held: 0, last: null });
    t.reviewed += 1;
    if (row.outcome === "approved") t.approvedAsWritten += 1;
    if (row.send_status === "sent") t.sent += 1;
    if (row.send_status === "failed") t.failed += 1;
    if (row.outcome !== "rejected" && row.send_status === "held") t.held += 1;
    t.last ??= row.sent_at ?? row.reviewed_at;
    if (row.send_status === "sent" && row.loan_ref && !lastSentByLoan[row.loan_ref]) lastSentByLoan[row.loan_ref] = row.sent_at ?? row.reviewed_at;
    if (row.outcome !== "rejected" && (row.send_status === "failed" || (row.send_status === "held" && row.send_error))) problems.push(row);
  }
  return { available: true, byTask, lastSentByLoan, problems: problems.slice(0, 20) };
}
