/**
 * One loan's real history, newest first: borrower questions, every bot draft a person
 * reviewed (and whether it went out), and Vesta change events. Read from Supabase only.
 */

import { getSupabaseAdmin } from "./supabase/admin";
import { supabaseConfigured } from "./reviews";
import type { Inbound } from "./drafts";

export type TimelineItem = {
  at: string;
  kind: "question" | "message" | "vesta";
  /** Who acted: the borrower, a bot, a person, or Vesta. */
  actor: string;
  channel: string;
  title: string;
  text: string;
  status?: { label: string; tone: "ok" | "waiting" | "attention" | "info" | "muted" };
};

export type LoanTimeline = {
  available: boolean;
  problem: string | null;
  items: TimelineItem[];
  /** Per bot task: when it last sent to this borrower. */
  lastSent: Record<string, string | null>;
  lastVestaEvent: string | null;
};

type Row = {
  id: string; task_type: string; bot: string; channel: string; subject: string | null;
  draft_body: string; final_body: string | null; outcome: string; reviewed_by: string; reviewed_at: string;
  reject_reason: string | null; send_status: string; send_error: string | null; sent_at: string | null;
  in_reply_to: Inbound | null;
};

const clip = (s: string, n = 280) => (s.length > n ? `${s.slice(0, n).trimEnd()}…` : s);

function sendStatus(r: Row): TimelineItem["status"] {
  if (r.outcome === "rejected") return { label: `Rejected by ${r.reviewed_by}`, tone: "muted" };
  const how = r.outcome === "edited" ? `Edited and approved by ${r.reviewed_by}` : `Approved as written by ${r.reviewed_by}`;
  if (r.send_status === "sent") return { label: `${how}, sent`, tone: "ok" };
  if (r.send_status === "failed") return { label: `${how}, send failed`, tone: "attention" };
  if (r.send_status === "sending") return { label: `${how}, sending`, tone: "info" };
  return { label: `${how}, not sent yet`, tone: "waiting" };
}

export async function loadLoanTimeline(loanRef: string, vestaLoanId: string | null): Promise<LoanTimeline> {
  const empty: LoanTimeline = { available: false, problem: null, items: [], lastSent: {}, lastVestaEvent: null };
  if (!supabaseConfigured()) return { ...empty, problem: "Supabase isn't set up for the admin app, so nothing is recorded yet." };
  const db = getSupabaseAdmin();
  const [msgs, events] = await Promise.all([
    db.from("outbound_messages")
      .select("id, task_type, bot, channel, subject, draft_body, final_body, outcome, reviewed_by, reviewed_at, reject_reason, send_status, send_error, sent_at, in_reply_to")
      .eq("loan_ref", loanRef).order("reviewed_at", { ascending: false }).limit(100),
    vestaLoanId
      ? db.from("vesta_webhook_events").select("id, event_type, change, path, event_at, received_at")
          .eq("loan_id", vestaLoanId).order("received_at", { ascending: false }).limit(50)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (msgs.error) return { ...empty, problem: `Supabase: ${msgs.error.message}` };

  const items: TimelineItem[] = [];
  const lastSent: Record<string, string | null> = {};
  for (const r of (msgs.data ?? []) as Row[]) {
    const channel = r.channel === "sms" ? "Text" : "Email";
    if (r.in_reply_to?.text) {
      const q = r.in_reply_to;
      items.push({ at: q.at, kind: "question", actor: q.from, channel: q.channel, title: q.subject || `${q.channel} from the borrower`, text: clip(q.text) });
    }
    items.push({
      at: r.sent_at ?? r.reviewed_at,
      kind: "message",
      actor: r.bot,
      channel,
      title: r.subject || r.task_type,
      text: clip(r.final_body ?? r.draft_body) + (r.reject_reason ? `\n\nWhy rejected: ${r.reject_reason}` : "") + (r.send_error ? `\n\nSend error: ${r.send_error}` : ""),
      status: sendStatus(r),
    });
    if (r.send_status === "sent" && !(r.task_type in lastSent)) lastSent[r.task_type] = r.sent_at ?? r.reviewed_at;
  }
  const ev = (events.error ? [] : events.data ?? []) as { event_type: string | null; change: string | null; path: string | null; event_at: string | null; received_at: string }[];
  for (const e of ev) {
    items.push({
      at: e.event_at ?? e.received_at,
      kind: "vesta",
      actor: "Vesta watcher",
      channel: "Webhook",
      title: [e.event_type, e.change].filter(Boolean).join(" · ") || "Loan changed",
      text: e.path ? `Changed: ${e.path}` : "",
    });
  }
  items.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return { available: true, problem: null, items, lastSent, lastVestaEvent: ev[0] ? ev[0].event_at ?? ev[0].received_at : null };
}
