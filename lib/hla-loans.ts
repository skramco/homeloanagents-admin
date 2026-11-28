/**
 * The HLA loan list in Supabase (public.hla_loans): which Vesta loans belong to HomeLoanAgents.
 *
 * Filled from the HLA pipeline view, which Mark set up to show only HLA loans. The webhook
 * receiver checks a loan against this list with one database lookup, so it never calls Vesta.
 */

import type { Loan } from "./types";
import type { VestaEnv } from "./vesta/config";
import { getSupabaseAdmin } from "./supabase/admin";
import { supabaseConfigured } from "./reviews";

export type SyncResult = { ok: true; env: VestaEnv; loans: number } | { ok: false; error: string };

const vestaId = (l: Loan) => (l.source === "vesta" && l.id.startsWith("v-") ? l.id.slice(2) : null);
const loanNumber = (l: Loan) => /^#(\S+)/.exec(l.vesta)?.[1] ?? null;

/** Adds every loan in the pipeline view to the list (and marks it seen now). */
export async function saveHlaLoans(env: VestaEnv, loans: Loan[]): Promise<SyncResult> {
  if (!supabaseConfigured()) return { ok: false, error: "Supabase isn't configured." };
  const now = new Date().toISOString();
  const rows = loans
    .map((l) => ({ id: vestaId(l), n: loanNumber(l) }))
    .filter((r): r is { id: string; n: string | null } => Boolean(r.id))
    .map((r) => ({ vesta_loan_id: r.id.toLowerCase(), vesta_env: env, loan_number: r.n, last_seen_at: now }));
  if (!rows.length) return { ok: true, env, loans: 0 };
  const { error } = await getSupabaseAdmin().from("hla_loans").upsert(rows, { onConflict: "vesta_env,vesta_loan_id" });
  if (error) return { ok: false, error: error.message };
  known.clear();
  return { ok: true, env, loans: rows.length };
}

// Answers kept briefly per server instance, so a burst of webhooks for one loan is one lookup.
const known = new Map<string, { hla: boolean; at: number }>();
// A loan that isn't on the list is checked again sooner, so a new loan is picked up quickly.
const TTL_MS = 5 * 60_000;
const MISS_TTL_MS = 60_000;

/** Whether a Vesta loan is on the HLA list. Throws if the database can't be reached. */
export async function isHlaLoan(env: VestaEnv, loanId: string): Promise<boolean> {
  const key = `${env}:${loanId.toLowerCase()}`;
  const hit = known.get(key);
  if (hit && Date.now() - hit.at < (hit.hla ? TTL_MS : MISS_TTL_MS)) return hit.hla;
  const { data, error } = await getSupabaseAdmin()
    .from("hla_loans")
    .select("vesta_loan_id")
    .eq("vesta_env", env)
    .eq("vesta_loan_id", loanId.toLowerCase())
    .maybeSingle();
  if (error) throw new Error(error.message);
  const hla = Boolean(data);
  if (known.size > 5000) known.clear();
  known.set(key, { hla, at: Date.now() });
  return hla;
}
