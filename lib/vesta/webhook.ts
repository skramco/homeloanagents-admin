/**
 * Vesta webhooks: signature check and payload shape.
 *
 * Vesta sends (API 26.4):
 *   x-webhook-timestamp: unix seconds
 *   x-webhook-signature-256: "sha256=<hex HMAC-SHA256 with the webhook secret>"
 * The exact signed string isn't documented to us yet, so the common forms are accepted:
 * the raw body, "<timestamp>.<body>" and "<timestamp><body>". The form that matched is
 * logged so it can be pinned down once confirmed.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export type VestaEvent = {
  id: string;
  change?: string;
  entityId?: string;
  entityType?: string;
  path?: string;
  loanId: string;
  loanChannel?: string;
  version?: string;
  type?: string;
  sourceType?: string;
  timestamp?: string;
  requestId?: string;
  retries?: number;
};

const MAX_SKEW_S = 5 * 60;

export type Verified = { ok: true; scheme: string } | { ok: false; status: number; error: string };

export function verifySignature(secret: string, body: string, timestamp: string | null, signature: string | null, nowS = Date.now() / 1000): Verified {
  if (!signature || !timestamp) return { ok: false, status: 401, error: "missing signature headers" };
  const ts = Number(timestamp);
  if (!Number.isFinite(ts) || Math.abs(nowS - ts) > MAX_SKEW_S) return { ok: false, status: 401, error: "timestamp too old or invalid" };
  const given = signature.trim().replace(/^sha256=/i, "").toLowerCase();
  if (!/^[0-9a-f]{64}$/.test(given)) return { ok: false, status: 401, error: "bad signature format" };
  const givenBuf = Buffer.from(given, "hex");
  const forms: [string, string][] = [
    ["body", body],
    ["timestamp.body", `${timestamp}.${body}`],
    ["timestamp+body", `${timestamp}${body}`],
  ];
  for (const [scheme, data] of forms) {
    const want = createHmac("sha256", secret).update(data, "utf8").digest();
    if (timingSafeEqual(want, givenBuf)) return { ok: true, scheme };
  }
  return { ok: false, status: 401, error: "signature mismatch" };
}

export function parseEvent(body: string): VestaEvent | null {
  try {
    const e = JSON.parse(body) as Partial<VestaEvent>;
    if (typeof e?.id !== "string" || typeof e.loanId !== "string" || !e.id || !e.loanId) return null;
    return e as VestaEvent;
  } catch {
    return null;
  }
}
