import type { Loan } from "../types";
import { loadLoanContexts, polishDrafts, type DraftResult } from "../drafts";
import { gmailConfigured, loadSupportEmail, supportMailbox } from "./gmail";
import { loadSupportTexts, twilioConfigured } from "./twilio";
import { draftReplies } from "./match";
import type { InboundMessage } from "./types";

export type SourceStatus = { name: string; configured: boolean; count: number; error: string | null };
export type SupportResult = DraftResult & { sources: SourceStatus[]; mailbox: string };

async function source(name: string, configured: boolean, load: () => Promise<InboundMessage[]>) {
  if (!configured) return { status: { name, configured, count: 0, error: null }, messages: [] as InboundMessage[] };
  try {
    const messages = await load();
    return { status: { name, configured, count: messages.length, error: null }, messages };
  } catch (err) {
    return { status: { name, configured, count: 0, error: err instanceof Error ? err.message : String(err) }, messages: [] as InboundMessage[] };
  }
}

/** Support email and texts from the last 7 days, each matched to a loan with a draft reply. */
export async function loadSupportInbox(loans: Loan[]): Promise<SupportResult> {
  const [email, text, ctx] = await Promise.all([
    source("Email (Google Workspace)", gmailConfigured(), loadSupportEmail),
    source("Text (Twilio)", twilioConfigured(), loadSupportTexts),
    loadLoanContexts(loans),
  ]);
  const messages = [...email.messages, ...text.messages].sort((a, b) => b.at.localeCompare(a.at));
  return {
    drafts: await polishDrafts(draftReplies(messages, loans, ctx.contexts)),
    checked: ctx.checked,
    skipped: ctx.skipped,
    errors: ctx.errors,
    sources: [email.status, text.status],
    mailbox: supportMailbox(),
  };
}
