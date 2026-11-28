/**
 * Sends an approved message: email through Resend, text through Twilio.
 *
 * Off unless SENDING_ENABLED=true. SEND_ONLY_TO (comma-separated emails or phone numbers)
 * limits who can receive anything, for testing on BETA loans. The bots' templates carry the
 * Emails go out in the homeloanagents-web layout with its Section 2.2 footer (lib/email-template).
 */

import { emailKey, phoneKey } from "./support/match";
import { supportMailbox } from "./support/gmail";
import { grokConfigured, stripFooter } from "./grok";
import { emailHtml, emailText, transactionalFooterText } from "./email-template";

export type Outgoing = {
  id: string;
  channel: "email" | "sms";
  to: string;
  subject: string | null;
  body: string;
  inReplyTo?: string | null;
};

export type SendOutcome = { ok: true; provider: "resend" | "twilio"; providerId: string } | { ok: false; error: string };

export const sendingEnabled = () => process.env.SENDING_ENABLED === "true";

/** Why a message can't be sent right now, or null if it can. */
/** The footer check: the email as it goes out must name the NMLS and Equal Housing. */
export function hasFooter(text: string): boolean {
  return /\bNMLS\b/i.test(text) && /Equal Housing/i.test(text);
}

export function sendBlocker(channel: "email" | "sms", to: string | null, body = ""): string | null {
  if (!sendingEnabled()) return "Sending is switched off (SENDING_ENABLED).";
  if (!to) return "There's no address to send to.";
  if (channel === "email") {
    if (!process.env.RESEND_API_KEY || !process.env.RESEND_FROM) return "Resend isn't set up (RESEND_API_KEY, RESEND_FROM).";
    if (!hasFooter(finalText("email", body))) return "The email has no compliance footer (NMLS and Equal Housing lines), so it can't go out.";
  } else if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN || !(process.env.TWILIO_FROM || process.env.TWILIO_SUPPORT_NUMBER)) {
    return "Twilio isn't set up for sending (TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM).";
  }
  const only = (process.env.SEND_ONLY_TO ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  if (only.length) {
    const key = channel === "email" ? emailKey(to) : phoneKey(to);
    const allowed = only.map((o) => (channel === "email" ? emailKey(o) : phoneKey(o)));
    if (!key || !allowed.includes(key)) return `Not sent: ${to} isn't on the SEND_ONLY_TO test list.`;
  }
  return null;
}

/**
 * The text exactly as it goes out, footer included. Emails use the same layout and Section 2.2
 * footer as homeloanagents-web: whatever footer the draft or an edit has is replaced, so it
 * appears exactly once.
 */
export function finalText(channel: "email" | "sms", body: string): string {
  if (channel === "email") return emailText(stripFooter(body));
  const sms = process.env.COMPLIANCE_SMS_FOOTER ?? "Reply STOP to opt out.";
  return `${body.trim()} ${sms}`.trim();
}

const toE164 = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : v.startsWith("+") ? v : `+${d}`;
};

async function sendEmail(m: Outgoing): Promise<SendOutcome> {
  const headers: Record<string, string> = {};
  if (m.inReplyTo) {
    headers["In-Reply-To"] = m.inReplyTo;
    headers["References"] = m.inReplyTo;
  }
  const res = await fetch(`${process.env.RESEND_API_BASE || "https://api.resend.com"}/emails`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      // Resend drops a repeat with the same key, so a retry can't double-send.
      "Idempotency-Key": m.id.slice(0, 256),
    },
    body: JSON.stringify({
      from: process.env.RESEND_FROM,
      to: [m.to],
      reply_to: process.env.RESEND_REPLY_TO || supportMailbox(),
      subject: m.subject || "A note from HomeLoanAgents",
      text: finalText("email", m.body),
      html: emailHtml(m.subject || "A note from HomeLoanAgents", stripFooter(m.body)),
      headers,
    }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
  if (!res.ok || !body.id) return { ok: false, error: `Resend answered ${res.status}: ${body.message ?? body.name ?? "no id"}` };
  return { ok: true, provider: "resend", providerId: body.id };
}

async function sendText(m: Outgoing): Promise<SendOutcome> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const res = await fetch(`${process.env.TWILIO_API_BASE || "https://api.twilio.com/2010-04-01"}/Accounts/${encodeURIComponent(sid)}/Messages.json`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ To: toE164(m.to), From: process.env.TWILIO_FROM || process.env.TWILIO_SUPPORT_NUMBER!, Body: finalText("sms", m.body) }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { sid?: string; message?: string };
  if (!res.ok || !body.sid) return { ok: false, error: `Twilio answered ${res.status}: ${body.message ?? "no sid"}` };
  return { ok: true, provider: "twilio", providerId: body.sid };
}

/** Never throws: a network error or bad answer comes back as { ok: false }. */
export async function deliver(m: Outgoing): Promise<SendOutcome> {
  try {
    return await (m.channel === "email" ? sendEmail(m) : sendText(m));
  } catch (err) {
    return { ok: false, error: `Couldn't reach ${m.channel === "email" ? "Resend" : "Twilio"}: ${err instanceof Error ? err.message : String(err)}` };
  }
}

/** Safe-to-show summary for the review screens (no keys). */
export function sendInfo() {
  return {
    enabled: sendingEnabled(),
    footer: transactionalFooterText().replace(/^--\n/, ""),
    smsFooter: process.env.COMPLIANCE_SMS_FOOTER ?? "Reply STOP to opt out.",
    testOnly: Boolean((process.env.SEND_ONLY_TO ?? "").trim()),
    grok: grokConfigured(),
  };
}
