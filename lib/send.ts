/**
 * Sends an approved message: email through Resend, text through Twilio.
 *
 * Off unless SENDING_ENABLED=true. SEND_ONLY_TO (comma-separated emails or phone numbers)
 * limits who can receive anything, for testing on BETA loans. The bots' templates carry the
 * compliance footer; an email whose final text lacks the NMLS and Equal Housing lines is not
 * sent. COMPLIANCE_FOOTER, if set, is appended to any email that doesn't already include it.
 */

import { emailKey, phoneKey } from "./support/match";
import { supportMailbox } from "./support/gmail";

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

/** The text exactly as it goes out, footer included. */
export function finalText(channel: "email" | "sms", body: string): string {
  if (channel === "email") {
    const footer = process.env.COMPLIANCE_FOOTER?.trim();
    return footer && !body.includes(footer) ? `${body.trim()}\n\n--\n${footer}` : body.trim();
  }
  const sms = process.env.COMPLIANCE_SMS_FOOTER ?? "Reply STOP to opt out.";
  return `${body.trim()} ${sms}`.trim();
}

const toE164 = (v: string) => {
  const d = v.replace(/\D/g, "");
  return d.length === 10 ? `+1${d}` : d.length === 11 && d.startsWith("1") ? `+${d}` : v.startsWith("+") ? v : `+${d}`;
};

const esc = (t: string) => t.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** Simple branded HTML for the same text: paragraphs, list lines, and a small grey footer. */
export function toHtml(text: string): string {
  const [main, ...rest] = text.split(/\n--\n/);
  const paras = main
    .trim()
    .split(/\n{2,}/)
    .map((p) => {
      const lines = p.split("\n");
      if (lines.every((l) => /^\s*[-•]\s+/.test(l) || !l.trim())) return `<ul>${lines.filter((l) => l.trim()).map((l) => `<li>${esc(l.replace(/^\s*[-•]\s+/, ""))}</li>`).join("")}</ul>`;
      return `<p>${lines.map(esc).join("<br>")}</p>`;
    })
    .join("");
  const foot = rest.length ? `<p style="margin-top:24px;font-size:12px;color:#626B79">${esc(rest.join("\n--\n").trim()).replace(/\n/g, "<br>")}</p>` : "";
  return `<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;color:#0B0D12;max-width:600px">${paras}${foot}</div>`;
}

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
      html: toHtml(finalText("email", m.body)),
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

export function deliver(m: Outgoing): Promise<SendOutcome> {
  return m.channel === "email" ? sendEmail(m) : sendText(m);
}

/** Safe-to-show summary for the review screens (no keys). */
export function sendInfo() {
  return {
    enabled: sendingEnabled(),
    footer: process.env.COMPLIANCE_FOOTER || null,
    smsFooter: process.env.COMPLIANCE_SMS_FOOTER ?? "Reply STOP to opt out.",
    testOnly: Boolean((process.env.SEND_ONLY_TO ?? "").trim()),
  };
}
