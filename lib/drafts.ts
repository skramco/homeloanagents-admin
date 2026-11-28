/**
 * Bot-drafted borrower messages, built from live Vesta data for human review.
 *
 * v1 drafts are templates filled from the loan (no model call yet), so every word is
 * predictable while the review loop and the approval stats get going. Nothing is sent:
 * the Outbound review screen is where a person approves, edits or rejects each one.
 */

import type { Loan, Role } from "./types";
import { STAGES } from "./sample-data";
import { getJson } from "./vesta/loan";

export type TaskType = "Daily update" | "Condition request";
export const TASK_TYPES: TaskType[] = ["Daily update", "Condition request"];

export type Draft = {
  id: string;
  loanId: string;
  taskType: TaskType;
  bot: string;
  channel: "Email";
  reviewer: Role;
  to: string | null;
  subject: string;
  body: string;
  /** Compliance monitor result for the draft as written. */
  monitor: "passed" | "flagged" | "blocked";
  note?: string;
};

export type DraftResult = { drafts: Draft[]; checked: number; skipped: number; errors: string[] };

type Json = Record<string, unknown>;
const isObj = (v: unknown): v is Json => typeof v === "object" && v !== null && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);

const MAX_LOANS = 25;
const CONCURRENCY = 5;
const today = () => new Intl.DateTimeFormat("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(new Date());
const fmtDate = (v: unknown) => {
  const s = str(v);
  if (!s) return null;
  const d = new Date(s.length === 10 ? `${s}T12:00:00Z` : s);
  return Number.isNaN(d.getTime()) ? null : new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "America/Los_Angeles" }).format(d);
};

/** Plain-language description of each pipeline stage, for borrowers. */
const STAGE_PLAIN = [
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

const SIGN_OFF = "Reply to this email with any questions, or write to support@homeloanagents.com. A real person reads every reply.\n\nThe HomeLoanAgents team";

/** Words the Compliance monitor routes to Mark instead of a processor. */
const PRICING_WORDS = /\b(rate|apr|points?|payment|lock(ed)?|\d+(\.\d+)?\s?%)\b/i;

function monitor(text: string): Pick<Draft, "monitor" | "note"> {
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

function openConditions(list: unknown): Json[] {
  if (!Array.isArray(list)) return [];
  return (list as Json[]).filter((c) => {
    const s = String(c.conditionStatus ?? c.status ?? "");
    // Open = not yet sent in by the borrower. "NotReadyToApprove" is open; ReadyToApprove, Approved and cancelled are not.
    return !/^(ReadyToApprove|Approved|AutomaticallyCancelled|ManuallyCancelled|ManuallyCompleted|AutomaticallyCompleted)$/i.test(s);
  });
}

function draftsForLoan(loan: Loan, vLoan: Json, conditions: Json[]): Draft[] {
  const borrower = Array.isArray(vLoan.borrowers) ? (vLoan.borrowers as Json[])[0] : undefined;
  const first = str(borrower?.firstName) ?? loan.name.split(" ")[0] ?? "there";
  const email = str(borrower?.emailAddress);
  const noEmail: Pick<Draft, "monitor" | "note"> | null = email ? null : { monitor: "blocked", note: "No borrower email in Vesta, so this can't be sent." };
  const owner = loan.owner;
  const vestaId = loan.id.replace(/^v-/, "");
  const drafts: Draft[] = [];

  // One email per open condition, in plain words, with how to resolve it.
  for (const c of conditions) {
    const name = str(c.objectiveName) ?? str(c.taskTemplateName) ?? str(c.documentTypeName) ?? "an item";
    const why = str(c.externalFacingMessage);
    const timing = String(c.conditionTiming ?? "");
    const when = /PriorToDocs|PriorToClosing|PriorToFunding/.test(timing) ? "before we can prepare your closing documents" : "for the underwriter to approve your loan";
    const body =
      `Hi ${first},\n\nTo keep your loan moving, we need one thing from you: ${name}.\n\n` +
      (why ? `${why}\n\n` : `We need this ${when}.\n\n`) +
      `How to send it: upload it in your HomeLoanAgents portal, or reply to this email with it attached. ` +
      `If you're not sure what counts, reply and we'll help.\n\n${SIGN_OFF}`;
    drafts.push({
      id: `cond-${vestaId}-${String(c.id ?? c.taskTemplateId ?? name).slice(0, 40)}`,
      loanId: loan.id,
      taskType: "Condition request",
      bot: "Processor / conditions",
      channel: "Email",
      reviewer: "Processor 2",
      to: email,
      subject: `One item needed for your loan: ${name}`,
      body,
      ...(noEmail ?? monitor(body)),
    });
  }

  // Daily update, even when nothing changed.
  const stage = loan.stage;
  const next: string[] = [];
  const le = fmtDate(vLoan.loanEstimateNeedsToBeSentDate);
  const cd = fmtDate(vLoan.closingDisclosureNeedsToBeSentDate);
  const close = fmtDate(vLoan.closingDate) ?? fmtDate(vLoan.closingDateEstimate);
  if (stage <= 4 && le) next.push(`Your Loan Estimate goes out by ${le}.`);
  if (stage >= 6 && cd) next.push(`Your Closing Disclosure goes out by ${cd}.`);
  if (close) next.push(`We're working toward closing on ${close}.`);
  const needs = conditions.length
    ? `What we need from you:\n${conditions.map((c) => `- ${str(c.objectiveName) ?? str(c.taskTemplateName) ?? "An item"}`).join("\n")}\nWe've sent a separate note on each with how to send it.`
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

/** Drafts for active Vesta loans (not funded), up to MAX_LOANS per load. */
export async function buildDrafts(loans: Loan[]): Promise<DraftResult> {
  const active = loans.filter((l) => l.source === "vesta" && l.stage < 8);
  const batch = active.slice(0, MAX_LOANS);
  const errors: string[] = [];
  const results = await mapLimit(batch, CONCURRENCY, async (loan) => {
    const id = encodeURIComponent(loan.id.replace(/^v-/, ""));
    try {
      const [vLoan, conds] = await Promise.all([getJson(`/loans/${id}`), getJson(`/loans/${id}/objective-conditions`)]);
      return draftsForLoan(loan, isObj(vLoan) ? vLoan : {}, openConditions(conds));
    } catch (err) {
      errors.push(`${loan.name}: ${err instanceof Error ? err.message : String(err)}`);
      return [];
    }
  });
  return { drafts: results.flat(), checked: batch.length, skipped: active.length - batch.length, errors };
}
