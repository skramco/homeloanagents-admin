/**
 * Bot-drafted borrower messages, built from live Vesta data for human review.
 *
 * v1 drafts are templates filled from the loan (no model call yet), so every word is
 * predictable while the review loop and the approval stats get going. Nothing is sent:
 * the Outbound review screen is where a person approves, edits or rejects each one.
 */

import { cache } from "react";
import type { Loan, Role } from "./types";
import { STAGES } from "./sample-data";
import { getJson } from "./vesta/loan";
import { grokConfigured, writeWithGrok, type Written } from "./grok";
import { conditionDetail, conditionSummary, isBorrowerCondition, isClosed } from "./conditions";

export type TaskType = "Daily update" | "Condition request" | "Support reply";
export const TASK_TYPES: TaskType[] = ["Daily update", "Condition request", "Support reply"];

/** The borrower message a support reply answers. */
export type Inbound = {
  channel: "Email" | "Text";
  from: string;
  at: string;
  subject?: string;
  text: string;
  /** How the sender was matched to the loan, or why they weren't. */
  match: string;
  messageId?: string;
};

export type Draft = {
  id: string;
  loanId: string;
  taskType: TaskType;
  bot: string;
  channel: "Email" | "Text";
  reviewer: Role;
  to: string | null;
  subject: string;
  body: string;
  /** Compliance monitor result for the draft as written. */
  monitor: "passed" | "flagged" | "blocked";
  note?: string;
  inbound?: Inbound;
  /** Who wrote the text: Grok, or the template (and why Grok's version wasn't used). */
  writtenBy?: "grok" | "template";
  writtenNote?: string;
};

export type DraftResult = { drafts: Draft[]; checked: number; skipped: number; errors: string[] };

export type Json = Record<string, unknown>;
export const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
export const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const MAX_LOANS = 25;
const CONCURRENCY = 5;
export const today = () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date());
export const fmtDate = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(d);
};

/** Plain-language description of each pipeline stage, for borrowers. */
export const STAGE_PLAIN = [
  "We have your contact details and are getting your application started.",
  "Your portal account is set up and ready for your application.",
  "We have your application and are reviewing it.",
  "We are working on your rate and pricing.",
  "Your disclosures are out for review and signature.",
  "Your loan is in processing: we are gathering and checking documents.",
  "Your loan is with the underwriter for review.",
  "Your loan is cleared and we are preparing for closing.",
  "Your loan has funded.",
];

export const SIGN_OFF = "Reply to this email with any questions, or write to support@homeloanagents.com. A real person reads every reply.\n\nThe HomeLoanAgents team";

/** Words the Compliance monitor routes to Mark instead of a processor. */
const PRICING_WORDS = /\b(rate|apr|points?|payment|lock(ed)?|\d+(\.\d+)?\s?%)\b/i;

export function monitor(text: string): Pick<Draft, "monitor" | "note"> {
  if (PRICING_WORDS.test(text)) return { monitor: "flagged", note: "Mentions pricing or a payment: Mark must approve it." };
  return { monitor: "passed" };
}

async function mapLimit<T, R>(items: T[], limit: number, fn: (t: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (i < items.length) {
        const idx = i++;
        out[idx] = await fn(items[idx]);
      }
    }),
  );
  return out;
}

/**
 * The borrower's open conditions: Borrower-party only (as the borrower portal shows them), and
 * not yet sent in. "NotReadyToApprove" is open; ReadyToApprove (with underwriting), Approved and
 * cancelled are not.
 */
export function openConditions(list: unknown): Json[] {
  if (!Array.isArray(list)) return [];
  return (list as Json[]).filter((c) => isBorrowerCondition(c) && !isClosed(c) && !/^(ReadyToApprove|ManuallyCompleted|AutomaticallyCompleted)$/i.test(String(c.conditionStatus ?? "")));
}

function draftsForLoan(loan: Loan, vLoan: Json, conditions: Json[]): Draft[] {
  const borrower = Array.isArray(vLoan.borrowers) ? (vLoan.borrowers as Json[])[0] : undefined;
  const first = str(borrower?.firstName) ?? loan.name.split(" ")[0] ?? "there";
  const email = str(borrower?.emailAddress);
  const noEmail: Pick<Draft, "monitor" | "note"> | null = email ? null : { monitor: "blocked", note: "No borrower email in Vesta, so this can't be sent." };
  const owner = loan.owner;
  const vestaId = loan.id.replace(/^v-/, "");
  const drafts: Draft[] = [];

  // Daily update, even when nothing changed.
  const stage = loan.stage;
  const next: string[] = [];
  const le = fmtDate(vLoan.loanEstimateNeedsToBeSentDate);
  const cd = fmtDate(vLoan.closingDisclosureNeedsToBeSentDate);
  const close = fmtDate(vLoan.closingDate) ?? fmtDate(vLoan.closingDateEstimate);
  if (stage <= 4 && le) next.push(`Your Loan Estimate goes out by ${le}.`);
  if (stage >= 6 && cd) next.push(`Your Closing Disclosure goes out by ${cd}.`);
  if (close) next.push(`We're working toward closing on ${close}.`);
  // One email a day per borrower: the open conditions ride in the daily update, each with
  // exactly what to provide, instead of a separate email per condition.
  const details = conditions.map(conditionDetail);
  const needs = details.length
    ? `What we need from you (${details.length} item${details.length === 1 ? "" : "s"}):\n\n` +
      details.map((d) => conditionSummary(d)).join("\n\n") +
      `\n\nHow to send ${details.length === 1 ? "it" : "them"}: upload in your HomeLoanAgents portal, or reply to this email with ${details.length === 1 ? "it" : "them"} attached. If you're not sure what counts, reply and we'll help.`
    : "What we need from you: nothing right now.";
  const body =
    `Hi ${first},\n\nHere's your loan update for ${today()}.\n\n` +
    `Where you are: ${STAGE_PLAIN[stage] ?? STAGES[stage]}\n\n` +
    `${needs}\n\n` +
    (next.length ? `What's next: ${next.join(" ")}\n\n` : "What's next: we'll update you as soon as anything moves.\n\n") +
    SIGN_OFF;
  drafts.unshift({
    id: `daily-${vestaId}-${new Date().toISOString().slice(0, 10)}`,
    loanId: loan.id,
    taskType: "Daily update",
    bot: "Concierge",
    channel: "Email",
    reviewer: owner,
    to: email,
    subject: `Your loan update for ${today()}`,
    body,
    ...(noEmail ?? monitor(body)),
  });
  return drafts;
}

/** An active Vesta loan with its full record and open conditions, as fetched for drafting. */
export type LoanContext = { loan: Loan; vLoan: Json; conditions: Json[] };
export type ContextResult = { contexts: LoanContext[]; checked: number; skipped: number; errors: string[] };

/** Active Vesta loans (not funded), up to MAX_LOANS, fetched once per request. */
export const loadLoanContexts = cache(async (loans: Loan[]): Promise<ContextResult> => {
  const active = loans.filter((l) => l.source === "vesta" && l.stage < 8);
  const batch = active.slice(0, MAX_LOANS);
  const errors: string[] = [];
  const results = await mapLimit(batch, CONCURRENCY, async (loan): Promise<LoanContext | null> => {
    const id = encodeURIComponent(loan.id.replace(/^v-/, ""));
    try {
      const [vLoan, conds] = await Promise.all([getJson(`/loans/${id}`), getJson(`/loans/${id}/objective-conditions`)]);
      return { loan, vLoan: isObj(vLoan) ? vLoan : {}, conditions: openConditions(conds) };
    } catch (err) {
      errors.push(`${loan.name}: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  });
  return { contexts: results.filter((r): r is LoanContext => r !== null), checked: batch.length, skipped: active.length - batch.length, errors };
});

/** A draft rewritten by Grok, with the Compliance monitor run again on what Grok wrote. */
function applyWritten(d: Draft, w: Written): Draft {
  if (w.by !== "grok") return { ...d, writtenBy: "template", writtenNote: w.why };
  const pinned = d.monitor === "flagged" && /asked about pricing/.test(d.note ?? "");
  return {
    ...d,
    subject: w.subject,
    body: w.body,
    writtenBy: "grok",
    ...(pinned ? {} : { note: undefined, ...monitor(`${w.subject}\n${w.body}`) }),
  };
}

const grokInput = (d: Draft) => ({ id: d.id, taskType: d.taskType, channel: d.channel, subject: d.subject, body: d.body, borrowerMessage: d.inbound?.text });

/**
 * For a page load: swaps in the wording Grok already wrote (from cache) and leaves every other
 * draft on its template. Never calls Grok, so the page doesn't wait on it.
 */
export async function polishDrafts(drafts: Draft[]): Promise<Draft[]> {
  if (!grokConfigured()) return drafts.map((d) => ({ ...d, writtenBy: "template" as const }));
  return mapLimit(drafts, 10, async (d) => {
    if (d.monitor === "blocked") return { ...d, writtenBy: "template" as const };
    const w = await writeWithGrok(grokInput(d), { peek: true });
    return w ? applyWritten(d, w) : { ...d, writtenBy: "template" as const, writtenNote: "Not written by Grok yet" };
  });
}

/** Has Grok write one template draft now (or returns its cached answer). */
export async function writeDraft(d: Draft): Promise<Draft> {
  if (d.monitor === "blocked" || d.writtenBy === "grok") return d;
  if (!grokConfigured()) return { ...d, writtenBy: "template", writtenNote: "Grok isn't set up (XAI_API_KEY)" };
  return applyWritten(d, await writeWithGrok(grokInput(d)));
}

/** Drafts for active Vesta loans (not funded), up to MAX_LOANS per load. */
export async function buildDrafts(loans: Loan[]): Promise<DraftResult> {
  const { contexts, checked, skipped, errors } = await loadLoanContexts(loans);
  const drafts = await polishDrafts(contexts.flatMap((c) => draftsForLoan(c.loan, c.vLoan, c.conditions)));
  return { drafts, checked, skipped, errors };
}
