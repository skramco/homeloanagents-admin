/**
 * Reads texts sent to the HomeLoanAgents support number from Twilio (read only).
 * Uses the Messages list API, so no webhook or database is needed to see them.
 */

import type { InboundMessage } from "./types";

const API = process.env.TWILIO_API_BASE || "https://api.twilio.com/2010-04-01";
const MAX = 25;

export function twilioConfigured(): boolean {
  return Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_SUPPORT_NUMBER);
}

type TwilioMessage = { sid: string; from: string; to: string; body: string; direction: string; date_sent: string | null; date_created: string };

/** Inbound texts to the support number from the last 7 days, newest first. */
export async function loadSupportTexts(): Promise<InboundMessage[]> {
  const sid = process.env.TWILIO_ACCOUNT_SID!;
  const auth = Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString("base64");
  const since = new Date(Date.now() - 7 * 864e5).toISOString().slice(0, 10);
  const qs = new URLSearchParams({ To: process.env.TWILIO_SUPPORT_NUMBER!, "DateSent>": since, PageSize: String(MAX) });
  const res = await fetch(`${API}/Accounts/${encodeURIComponent(sid)}/Messages.json?${qs}`, { headers: { Authorization: `Basic ${auth}` }, cache: "no-store" });
  if (!res.ok) throw new Error(`Twilio answered ${res.status}`);
  const list = ((await res.json()) as { messages?: TwilioMessage[] }).messages ?? [];
  return list
    .filter((m) => m.direction === "inbound")
    .map((m) => ({
      id: `sms-${m.sid}`,
      channel: "Text" as const,
      from: m.from,
      address: m.from,
      at: new Date(m.date_sent ?? m.date_created).toISOString(),
      text: m.body.trim(),
    }));
}
