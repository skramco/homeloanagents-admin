"use server";

import { cookies } from "next/headers";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";
import { monitor, type Draft } from "@/lib/drafts";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { missingTable, supabaseConfigured } from "@/lib/reviews";
import { currentVestaEnv } from "@/lib/vesta/config";
import type { ReviewOutcome } from "@/components/Workspace";
import { deliver, sendBlocker } from "@/lib/send";

export type ReviewResult = { ok: true; saved: boolean; sent?: boolean; note?: string } | { ok: false; error: string };

/**
 * Records a person's decision on a draft. The reviewer is the signed-in person, and the
 * Compliance monitor runs again on the text as approved, so an edit can't slip pricing past Mark.
 */
export async function submitReview(draft: Draft, outcome: ReviewOutcome, finalBody: string, reason?: string): Promise<ReviewResult> {
  const session = await verifySessionValue((await cookies()).get(SESSION_COOKIE)?.value);
  if (!session) return { ok: false, error: "Your session ended. Sign in again." };
  const reviewer = session.name;

  const text = finalBody.trim();
  if (outcome !== "rejected") {
    if (!text) return { ok: false, error: "The message is empty." };
    if (draft.monitor === "blocked") return { ok: false, error: draft.note ?? "This draft is blocked and can't be approved." };
    const check = monitor(`${draft.subject}\n${text}`);
    if ((check.monitor === "flagged" || draft.monitor === "flagged") && reviewer !== "Mark") {
      return { ok: false, error: "This mentions pricing or a payment, so only Mark can approve it." };
    }
  }

  if (!supabaseConfigured()) return { ok: true, saved: false };
  const env = await currentVestaEnv();
  const row = {
    id: draft.id,
    loan_ref: draft.loanId || null,
    vesta_env: env,
    task_type: draft.taskType,
    bot: draft.bot,
    channel: draft.channel === "Text" ? "sms" : "email",
    to_address: draft.to,
    subject: draft.subject || null,
    draft_body: draft.body,
    final_body: outcome === "rejected" ? null : text,
    monitor: draft.monitor,
    monitor_note: draft.note ?? null,
    outcome,
    reviewed_by: reviewer,
    reject_reason: outcome === "rejected" ? reason?.trim() || null : null,
    send_status: outcome === "rejected" ? "not_sending" : "held",
    in_reply_to: draft.inbound ?? null,
  };
  const db = getSupabaseAdmin();
  const { error } = await db.from("outbound_messages").insert(row);
  if (error) {
    if (error.code === "23505") return { ok: false, error: "Someone already reviewed this draft." };
    if (missingTable(error)) return { ok: true, saved: false };
    return { ok: false, error: `Couldn't save the review: ${error.message}` };
  }
  if (outcome === "rejected") return { ok: true, saved: true };

  // Send. Only a saved approval is ever sent, and only once: the row is claimed first.
  const blocker = sendBlocker(row.channel as "email" | "sms", draft.to);
  if (blocker) return { ok: true, saved: true, sent: false, note: `Saved, not sent. ${blocker}` };
  const claim = await db.from("outbound_messages").update({ send_status: "sending", updated_at: new Date().toISOString() }).eq("id", draft.id).eq("send_status", "held").select("id");
  if (claim.error || !claim.data?.length) return { ok: true, saved: true, sent: false, note: "Saved. It's already being sent." };
  const out = await deliver({ id: draft.id, channel: row.channel as "email" | "sms", to: draft.to!, subject: row.subject, body: text, inReplyTo: draft.inbound?.messageId ?? null });
  const now = new Date().toISOString();
  if (!out.ok) {
    await db.from("outbound_messages").update({ send_status: "failed", send_error: out.error, updated_at: now }).eq("id", draft.id);
    return { ok: true, saved: true, sent: false, note: `Saved, but sending failed: ${out.error}` };
  }
  await db.from("outbound_messages").update({ send_status: "sent", provider: out.provider, provider_message_id: out.providerId, sent_at: now, updated_at: now }).eq("id", draft.id);
  return { ok: true, saved: true, sent: true };
}
