/**
 * Reads support@homeloanagents.com from Google Workspace with the Gmail API (read only).
 *
 * Auth: a Google service account with domain-wide delegation for the scope
 * https://www.googleapis.com/auth/gmail.readonly, acting as the support mailbox.
 * Nothing is marked read, labelled or sent from here.
 */

import { createSign } from "node:crypto";
import type { InboundMessage } from "./types";

const SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL || "https://oauth2.googleapis.com/token";
const GMAIL = process.env.GMAIL_API_BASE || "https://gmail.googleapis.com/gmail/v1";
const MAX = 25;

export const supportMailbox = () => process.env.SUPPORT_MAILBOX || "support@homeloanagents.com";

function privateKey(): string | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!raw) return null;
  // Netlify env vars often hold the key with literal \n, or base64 encoded.
  const k = raw.includes("BEGIN") ? raw : Buffer.from(raw, "base64").toString("utf8");
  return k.replace(/\\n/g, "\n");
}

export function gmailConfigured(): boolean {
  return Boolean(process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL && process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY);
}

const b64url = (b: Buffer | string) => Buffer.from(b).toString("base64url");

async function accessToken(): Promise<string> {
  const key = privateKey();
  const iss = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  if (!key || !iss) throw new Error("Google Workspace isn't set up");
  const now = Math.floor(Date.now() / 1000);
  const head = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = b64url(JSON.stringify({ iss, sub: supportMailbox(), scope: SCOPE, aud: "https://oauth2.googleapis.com/token", iat: now, exp: now + 3600 }));
  const sig = createSign("RSA-SHA256").update(`${head}.${claim}`).sign(key);
  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${head}.${claim}.${b64url(sig)}` }),
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as { access_token?: string; error?: string; error_description?: string };
  if (!res.ok || !body.access_token) throw new Error(`Google sign-in failed: ${body.error_description ?? body.error ?? res.status}`);
  return body.access_token;
}

type Part = { mimeType?: string; body?: { data?: string }; parts?: Part[]; headers?: { name: string; value: string }[] };

function findText(p: Part | undefined, mime: string): string | null {
  if (!p) return null;
  if (p.mimeType === mime && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  for (const c of p.parts ?? []) {
    const t = findText(c, mime);
    if (t) return t;
  }
  return null;
}

/** Drops the quoted earlier thread and signatures so the bot answers only what was just asked. */
export function newestText(text: string): string {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const out: string[] = [];
  for (const line of lines) {
    if (/^On .+wrote:\s*$/.test(line) || /^-{2,}\s*Original Message/i.test(line) || /^From: /.test(line) || /^>/.test(line) || /^--\s*$/.test(line)) break;
    out.push(line);
  }
  return out.join("\n").trim();
}

const header = (p: Part, name: string) => p.headers?.find((h) => h.name.toLowerCase() === name.toLowerCase())?.value ?? "";

/** Address part of a From header: "Dana R <dana@x.com>" → dana@x.com */
export function emailOf(from: string): string {
  const m = from.match(/<([^>]+)>/);
  return (m ? m[1] : from).trim().toLowerCase();
}

/** Inbox email to the support mailbox from the last 7 days, newest first. */
export async function loadSupportEmail(): Promise<InboundMessage[]> {
  const token = await accessToken();
  const user = encodeURIComponent(supportMailbox());
  const auth = { Authorization: `Bearer ${token}` };
  const q = encodeURIComponent("in:inbox newer_than:7d -from:me -category:promotions");
  const list = await fetch(`${GMAIL}/users/${user}/messages?maxResults=${MAX}&q=${q}`, { headers: auth, cache: "no-store" });
  if (!list.ok) throw new Error(`Gmail answered ${list.status}`);
  const ids = (((await list.json()) as { messages?: { id: string }[] }).messages ?? []).map((m) => m.id);
  const msgs = await Promise.all(
    ids.map(async (id) => {
      const r = await fetch(`${GMAIL}/users/${user}/messages/${id}?format=full`, { headers: auth, cache: "no-store" });
      if (!r.ok) return null;
      const m = (await r.json()) as { id: string; threadId: string; internalDate?: string; snippet?: string; payload?: Part };
      const p = m.payload ?? {};
      const raw = findText(p, "text/plain") ?? (findText(p, "text/html") ?? m.snippet ?? "").replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ");
      const from = header(p, "From");
      return {
        id: `gmail-${m.id}`,
        channel: "Email" as const,
        from,
        address: emailOf(from),
        subject: header(p, "Subject"),
        at: m.internalDate ? new Date(Number(m.internalDate)).toISOString() : new Date().toISOString(),
        text: newestText(raw) || (m.snippet ?? ""),
        threadId: m.threadId,
      };
    }),
  );
  return msgs.filter((m): m is NonNullable<typeof m> => m !== null);
}
