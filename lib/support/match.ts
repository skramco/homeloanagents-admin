/**
 * Matches a support email or text to the borrower's loan by the email address or phone number
 * on file, then drafts a reply in that loan's context for a person to review.
 *
 * The bot never guesses: an unknown sender, or one that matches more than one loan, gets a reply
 * that asks who they are or which loan, and shares nothing about any loan.
 */

import type { Loan } from "../types";
import { STAGES } from "../sample-data";
import { SIGN_OFF, STAGE_PLAIN, fmtDate, monitor, str, type Draft, type Json, type LoanContext } from "../drafts";
import type { InboundMessage } from "./types";

/** Last 10 digits, so +1 (555) 010-2244 and 5550102244 match. */
export const phoneKey = (v: unknown) => {
  const d = String(v ?? "").replace(/\D/g, "");
  return d.length >= 10 ? d.slice(-10) : null;
};
export const emailKey = (v: unknown) => {
  const s = String(v ?? "").trim().toLowerCase();
  return /^[^@\s]+@[^@\s]+$/.test(s) ? s : null;
};

type Hit = { loan: Loan; ctx?: LoanContext; first: string | null; by: string };

function borrowersOf(ctx: LoanContext): Json[] {
  return Array.isArray(ctx.vLoan.borrowers) ? (ctx.vLoan.borrowers as Json[]) : [];
}

/** Every known borrower email and phone → the loans it belongs to. */
export function buildIndex(loans: Loan[], contexts: LoanContext[]) {
  const index = new Map<string, Hit[]>();
  const add = (key: string | null, hit: Hit) => {
    if (!key) return;
    const list = index.get(key) ?? [];
    if (!list.some((h) => h.loan.id === hit.loan.id)) list.push(hit);
    index.set(key, list);
  };
  for (const ctx of contexts) {
    for (const b of borrowersOf(ctx)) {
      const first = str(b.firstName);
      add(emailKey(b.emailAddress), { loan: ctx.loan, ctx, first, by: "Email on the Vesta loan" });
      for (const p of Array.isArray(b.phoneNumbers) ? (b.phoneNumbers as Json[]) : []) {
        add(phoneKey(p.number), { loan: ctx.loan, ctx, first, by: "Phone on the Vesta loan" });
      }
    }
  }
  for (const loan of loans) {
    if (loan.source === "vesta") continue;
    const first = loan.name.split(" ")[0] || null;
    add(emailKey(loan.email), { loan, first, by: "Email from the intake call" });
    add(phoneKey(loan.phone), { loan, first, by: "Phone from the intake call" });
  }
  return index;
}

const PRICING = /\b(rate|apr|points?|payment|lock(ed|ing)?|cost|fees?|cash to close)\b/i;
const CLOSING = /\b(clos(e|ing)|funding|fund|move[- ]?in|keys|finish)\b/i;
const DOCS = /\b(document|doc|statement|stub|pay ?stub|w-?2|tax|upload|attach|sent|received|get my|got my)\b/i;

function closingSentence(ctx?: LoanContext): string | null {
  if (!ctx) return null;
  const d = fmtDate(ctx.vLoan.closingDate) ?? fmtDate(ctx.vLoan.closingDateEstimate);
  return d ? `We're working toward closing on ${d}.` : null;
}

function openItems(ctx?: LoanContext): string[] {
  return (ctx?.conditions ?? []).map((c) => str(c.objectiveName) ?? str(c.taskTemplateName) ?? "An item");
}

/** The answer itself, in the loan's context, before greeting and sign-off. */
function answer(msg: InboundMessage, hit: Hit): string {
  const where = STAGE_PLAIN[hit.loan.stage] ?? STAGES[hit.loan.stage] ?? "We're working on your loan.";
  const items = openItems(hit.ctx);
  const needs = items.length ? `What we still need from you: ${items.join("; ")}.` : hit.ctx ? "We don't need anything else from you right now." : "";
  const close = closingSentence(hit.ctx);
  if (PRICING.test(msg.text)) {
    return "Good question. Mark, your loan officer, will look at the numbers for your loan and reply to you directly today.";
  }
  if (CLOSING.test(msg.text)) {
    return [close ?? "We don't have a closing date set yet. We'll tell you as soon as one is.", where].join(" ");
  }
  if (DOCS.test(msg.text)) {
    const open = items.length ? `Still open on your file: ${items.join("; ")}. Anything you just sent comes off this list once we've checked it.` : "";
    return ["Thanks for sending that. Someone on our team will confirm it's on your file.", open].filter(Boolean).join(" ");
  }
  return [where, needs, close].filter(Boolean).join(" ");
}

function compose(msg: InboundMessage, greetingName: string | null, core: string): string {
  if (msg.channel === "Text") return `Hi${greetingName ? ` ${greetingName}` : ""}. ${core} - HomeLoanAgents`;
  return `Hi${greetingName ? ` ${greetingName}` : ""},\n\n${core}\n\n${SIGN_OFF}`;
}

/** One draft reply per inbound message. */
export function draftReplies(messages: InboundMessage[], loans: Loan[], contexts: LoanContext[]): Draft[] {
  const index = buildIndex(loans, contexts);
  return messages.map((msg) => {
    const key = msg.channel === "Email" ? emailKey(msg.address) : phoneKey(msg.address);
    const hits = key ? index.get(key) ?? [] : [];
    const base = {
      id: `support-${msg.id}`,
      taskType: "Support reply" as const,
      bot: "Concierge",
      channel: msg.channel,
      to: msg.address,
      subject: msg.channel === "Email" ? (/^re:/i.test(msg.subject ?? "") ? msg.subject! : `Re: ${msg.subject || "Your message"}`) : "",
    };
    const inbound = { channel: msg.channel, from: msg.from, at: msg.at, subject: msg.subject, text: msg.text, messageId: msg.messageId };

    if (hits.length === 1) {
      const hit = hits[0];
      const body = compose(msg, hit.first, answer(msg, hit));
      const asksPricing = PRICING.test(msg.text);
      const checked = monitor(body);
      return {
        ...base,
        loanId: hit.loan.id,
        reviewer: asksPricing ? "Mark" : hit.loan.owner,
        body,
        ...(asksPricing ? { monitor: "flagged" as const, note: "The borrower asked about pricing: Mark must approve the reply." } : checked),
        inbound: { ...inbound, match: hit.by },
      };
    }

    const why = hits.length > 1 ? `Matches ${hits.length} loans: ${hits.map((h) => h.loan.name).join(", ")}` : "No loan has this " + (msg.channel === "Email" ? "email" : "phone number");
    const ask =
      hits.length > 1
        ? "Thanks for your message. So we answer about the right loan, which property is this about?"
        : "Thanks for writing. So we can find your file, please reply with your full name and the phone number or loan number on your application. We'll answer as soon as we've matched it.";
    return {
      ...base,
      loanId: hits.length > 1 ? hits[0].loan.id : "",
      reviewer: "Processor 1",
      body: compose(msg, null, ask),
      monitor: "passed" as const,
      note: hits.length > 1 ? "Several loans match. Check which one before you approve." : "Unknown sender. The reply shares nothing about any loan.",
      inbound: { ...inbound, match: why },
    };
  });
}
