/**
 * Real loan files from a Vesta pipeline view.
 *
 * Same call as pro-api's QueryPipelineViewAsync:
 *   POST {baseUrl}/pipeline/views
 *   { pipelineViewId, userId, limit, offset, filters: [] }
 * The response has `columns` (id + name) and `loans` (id + positional `columns` values),
 * so each value is read by its column name, as pro-api's PipelineLoanMapper does.
 */

import type { Health, Loan, TridState } from "../types";
import { STAGE_BOT, STAGES } from "../sample-data";
import { currentVestaEnv, isConfigured, vestaConfig, vestaFetch, type VestaEnv } from "./config";

type PipelineColumn = { id?: string; name?: string };
type PipelineLoanRow = { id?: string; columns?: unknown[] };
type PipelineResponse = {
  columns?: PipelineColumn[];
  loans?: PipelineLoanRow[];
  pagination?: { totalNumberOfRecords?: number };
};

export type VestaPipelineResult = {
  env: VestaEnv;
  loans: Loan[];
  total: number | null;
  /** Why no loans were loaded, if so. Shown on the pipeline page. */
  error: string | null;
  /** Column names in the view, for checking the mapping. */
  columns: string[];
};

const PAGE_SIZE = 100;

// ── cell readers ──

function text(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  if (typeof v === "string") return v.trim() || null;
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (Array.isArray(v)) {
    const parts = v.map(text).filter(Boolean);
    return parts.length ? parts.join(", ") : null;
  }
  if (typeof v === "object") {
    const o = v as Record<string, unknown>;
    for (const k of ["fullName", "name", "displayName", "value"]) {
      if (typeof o[k] === "string" && (o[k] as string).trim()) return (o[k] as string).trim();
    }
    const first = typeof o.firstName === "string" ? o.firstName : "";
    const last = typeof o.lastName === "string" ? o.lastName : "";
    if (first || last) return `${first} ${last}`.trim();
  }
  return null;
}

function num(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) ? v : null;
  const s = text(v);
  if (!s) return null;
  const n = Number(s.replace(/[$,%\s]/g, ""));
  return Number.isFinite(n) ? n : null;
}

function date(v: unknown): Date | null {
  const s = text(v);
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : d;
}

const fmtDate = (d: Date | null) =>
  d ? new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(d) : "";
const fmtMoney = (n: number | null) =>
  n === null ? "Not set" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);

function addBusinessDays(d: Date, days: number): Date {
  const out = new Date(d);
  let added = 0;
  while (added < days) {
    out.setUTCDate(out.getUTCDate() + 1);
    const wd = out.getUTCDay();
    if (wd !== 0 && wd !== 6) added++;
  }
  return out;
}

/** Maps a Vesta stage name onto the 9 pipeline stages. Unknown names land on Application. */
export function stageIndex(vestaStage: string | null): number {
  const s = (vestaStage ?? "").toLowerCase();
  if (!s) return 2;
  if (/fund|purchased|sold|servic/.test(s)) return 8;
  if (/clos|clear to close|ctc|\bdocs?\b/.test(s)) return 7;
  if (/underwrit|approv|condition|suspend|decision/.test(s)) return 6;
  if (/disclos/.test(s)) return 4;
  if (/process|submit/.test(s)) return 5;
  if (/lock|pric|quote/.test(s)) return 3;
  return 2;
}

function rowToLoan(row: PipelineLoanRow, colIndex: Map<string, number>): Loan | null {
  if (!row.id) return null;
  const cols = row.columns ?? [];
  const raw = (...names: string[]) => {
    for (const n of names) {
      const i = colIndex.get(n.toLowerCase());
      if (i !== undefined && i < cols.length && cols[i] !== null && cols[i] !== undefined && cols[i] !== "") return cols[i];
    }
    return null;
  };
  const str = (...names: string[]) => text(raw(...names));

  const loanNumber = str("Loan number", "loanNumber");
  const vestaStage = str("Stage");
  const stage = stageIndex(vestaStage);
  const name =
    str("Primary borrower full name") ?? str("Borrower names") ?? str("Last name") ?? (loanNumber ? `Loan #${loanNumber}` : "Unnamed borrower");

  const appDate = date(raw("Application completed date", "TPO application date", "Application date"));
  const leSent = date(raw("Initial loan estimate sent date"));
  const cdSent = date(raw("Closing disclosure sent date"));
  const lockStatus = str("Rate lock status");
  const lockExp = date(raw("Lock expiration date"));
  const lockConfirmed = date(raw("Lock confirmed date", "Rate locked date"));
  const estClose = date(raw("Closing date scheduled", "ClosingDateScheduled", "Estimated close date"));
  const funded = date(raw("Funded date", "Actual disbursement date"));
  const ctc = date(raw("Cleared to close date"));
  const submittedUw = date(raw("TPO submitted to underwriting date"));
  const lastUpdated = date(raw("Last updated any", "LastUpdatedAny", "Last updated"));
  const noteRate = num(raw("Note rate"));
  const openTasks = num(raw("Num open tasks", "NumOpenTasks"));
  const openBorrowerTasks = num(raw("Num open borrower tasks", "NumOpenBorrowerTasks"));
  const vestaLower = (vestaStage ?? "").toLowerCase();

  // TRID: the LE is due 3 business days after the application is complete.
  let trid = "No application date in Vesta";
  let tridState: TridState = "muted";
  if (leSent) {
    trid = `LE sent ${fmtDate(leSent)}`;
    tridState = "ok";
  } else if (appDate) {
    const due = addBusinessDays(appDate, 3);
    const msLeft = due.getTime() - Date.now();
    trid = msLeft < 0 ? `LE overdue (was due ${fmtDate(due)})` : `LE due ${fmtDate(due)}`;
    tridState = msLeft < 36 * 3600 * 1000 ? "warn" : "ok";
  }

  let health: Health = "ok";
  if (/withdraw|denied|declin|cancel|suspend|adverse/.test(vestaLower) || (tridState === "warn" && !leSent)) health = "attention";
  else if (openBorrowerTasks && openBorrowerTasks > 0) health = "waiting";

  const dates: string[] = [];
  dates[2] = fmtDate(appDate);
  dates[3] = fmtDate(lockConfirmed);
  dates[4] = fmtDate(leSent);
  dates[6] = fmtDate(submittedUw);
  dates[7] = fmtDate(ctc ?? cdSent);
  dates[8] = fmtDate(funded);

  const lock = lockStatus
    ? `${noteRate !== null ? `${noteRate}% · ` : ""}${lockStatus}${lockExp ? ` · exp ${fmtDate(lockExp)}` : ""}`
    : "Not locked";

  const facts: { label: string; value: string }[] = [];
  const addFact = (label: string, value: string | null | undefined) => {
    if (value) facts.push({ label, value });
  };
  addFact("Vesta loan number", loanNumber);
  addFact("Vesta stage", vestaStage);
  addFact("Loan originator", str("Loan originator"));
  addFact("Processor", str("primaryProcessor", "Processor"));
  addFact("Underwriter", str("primaryUnderwriter", "Underwriter"));
  addFact("Underwriting decision", str("Latest loan decision", "UW decision"));
  addFact("Property", [str("Subject property city"), str("Subject property state"), str("Subject property zip code")].filter(Boolean).join(", "));
  addFact("Property type", str("Property type"));
  addFact("Note rate", noteRate !== null ? `${noteRate}%` : null);
  addFact("LTV", str("Gross LTV ratio"));
  addFact("Credit score", str("Lowest median credit score"));
  addFact("DTI", str("Debt to income ratio"));
  addFact("Open tasks", openTasks !== null ? `${openTasks}${openBorrowerTasks ? ` (${openBorrowerTasks} on the borrower)` : ""}` : null);
  addFact("Lead source", str("Lead source", "Lead source ID", "leadSourceId"));
  addFact("Last updated in Vesta", lastUpdated ? fmtDate(lastUpdated) : null);

  return {
    id: `v-${row.id}`,
    source: "vesta",
    name,
    state: str("Subject property state") ?? "—",
    purpose: str("Loan purpose") ?? "Not set",
    amount: fmtMoney(num(raw("Loan amount"))),
    program: str("Program name") ?? str("Mortgage type") ?? "Not set",
    stage,
    health,
    owner: stage <= 4 ? "Processor 1" : "Processor 2",
    waiting:
      openBorrowerTasks && openBorrowerTasks > 0
        ? `${openBorrowerTasks} open borrower task${openBorrowerTasks === 1 ? "" : "s"} in Vesta`
        : openTasks
          ? `${openTasks} open task${openTasks === 1 ? "" : "s"} in Vesta`
          : "Nothing flagged in Vesta",
    bot: STAGE_BOT[stage],
    botNow: "Not connected to this file yet",
    lastContact: lastUpdated ? `Vesta update · ${fmtDate(lastUpdated)}` : "Vesta · no update date",
    lock,
    closing: fmtDate(funded ?? estClose),
    vesta: loanNumber ? `#${loanNumber} · ${vestaStage ?? STAGES[stage]}` : vestaStage ?? "in Vesta",
    trid,
    tridState,
    consent: { aiDisclosure: null, tcpa: null, esign: null, recording: null },
    dates,
    gaps: [],
    conditions: [],
    facts,
  };
}

/** Loads the HLA pipeline view from Vesta in the selected environment (BETA by default). */
export async function loadVestaPipeline(): Promise<VestaPipelineResult> {
  const env = await currentVestaEnv();
  const c = vestaConfig(env);
  const empty = (error: string): VestaPipelineResult => ({ env, loans: [], total: null, error, columns: [] });
  if (!isConfigured(c)) {
    const required = env === "prod" ? "VESTA_PROD_API_URL and VESTA_PROD_API_TOKEN" : "VESTA_BETA_API_TOKEN";
    return empty(`Vesta ${env.toUpperCase()} is not configured. Add ${required} in Netlify.`);
  }
  if (!c.pipelineViewId) return empty(`No ${env.toUpperCase()} pipeline view yet. Add VESTA_${env.toUpperCase()}_PIPELINE_VIEW_ID in Netlify.`);

  try {
    const res = await vestaFetch(
      "/pipeline/views",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineViewId: c.pipelineViewId, userId: c.userId, limit: PAGE_SIZE, offset: 0, filters: [] }),
        signal: AbortSignal.timeout(20_000),
      },
      env,
    );
    if (!res.ok) {
      const body = (await res.text()).slice(0, 300).replace(/\s+/g, " ");
      return empty(`Vesta ${env.toUpperCase()} answered ${res.status}${body ? `: ${body}` : ""}`);
    }
    const data = (await res.json()) as PipelineResponse;
    const names = (data.columns ?? []).map((col) => col.name ?? "");
    const colIndex = new Map<string, number>();
    names.forEach((n, i) => {
      if (n) colIndex.set(n.toLowerCase(), i);
    });
    const loans = (data.loans ?? []).map((r) => rowToLoan(r, colIndex)).filter((l): l is Loan => l !== null);
    return { env, loans, total: data.pagination?.totalNumberOfRecords ?? loans.length, error: null, columns: names.filter(Boolean) };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return empty(`Could not reach Vesta ${env.toUpperCase()} (${message}).`);
  }
}
