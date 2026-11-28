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
};

const WINDOW = 50;

export const supabaseConfigured = () => Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);

export function missingTable(err: { code?: string; message?: string } | null): boolean {
  return Boolean(err && (err.code === "42P01" || err.code === "PGRST205" || /outbound_messages/.test(err.message ?? "")));
}

export async function loadSavedReviews(ids: string[]): Promise<SavedReviews> {
  const none: SavedReviews = { available: false, problem: null, reviewed: {}, tallies: {} };
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
  return { available: true, problem: null, reviewed, tallies };
}
