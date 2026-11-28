/**
 * Vesta webhook receiver: https://admin.homeloanagents.com/api/webhooks/vesta
 *
 * 1. Checks the HMAC signature with VESTA_WEBHOOK_SECRET.
 * 2. Keeps the event only if the loan is on the HLA loan list (one Supabase lookup, no Vesta call).
 * 3. Stores it once (Vesta's event id is the key, so retries don't duplicate) for the bots.
 * Always answers fast. Events for other loans get 200 and are dropped.
 */

import { NextResponse } from "next/server";
import { isHlaLoan } from "@/lib/hla-loans";
import { supabaseConfigured } from "@/lib/reviews";
import { getSupabaseAdmin } from "@/lib/supabase/admin";
import { parseEvent, verifySignature } from "@/lib/vesta/webhook";

export const dynamic = "force-dynamic";

const env = () => (process.env.VESTA_WEBHOOK_ENV === "prod" ? "prod" : "beta");

export async function POST(req: Request) {
  const secret = process.env.VESTA_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "VESTA_WEBHOOK_SECRET isn't set" }, { status: 503 });
  const body = await req.text();
  const check = verifySignature(secret, body, req.headers.get("x-webhook-timestamp"), req.headers.get("x-webhook-signature-256"));
  if (!check.ok) {
    console.warn(`vesta webhook rejected: ${check.error}`);
    return NextResponse.json({ error: check.error }, { status: check.status });
  }
  const event = parseEvent(body);
  if (!event) return NextResponse.json({ error: "not a Vesta loan event" }, { status: 400 });
  if (!supabaseConfigured()) return NextResponse.json({ error: "Supabase isn't configured" }, { status: 503 });

  try {
    if (!(await isHlaLoan(env(), event.loanId))) return NextResponse.json({ ok: true, kept: false });
    const { error } = await getSupabaseAdmin()
      .from("vesta_webhook_events")
      .upsert(
        {
          id: event.id,
          vesta_env: env(),
          loan_id: event.loanId.toLowerCase(),
          event_type: event.type ?? null,
          change: event.change ?? null,
          path: event.path ?? null,
          event_at: event.timestamp ?? null,
          payload: JSON.parse(body),
        },
        { onConflict: "id", ignoreDuplicates: true },
      );
    if (error) throw new Error(error.message);
    console.log(`vesta webhook kept ${event.id} (${event.type} ${event.path ?? ""}) signed as ${check.scheme}`);
    return NextResponse.json({ ok: true, kept: true });
  } catch (err) {
    // 5xx so Vesta retries later.
    console.error("vesta webhook failed", err);
    return NextResponse.json({ error: "couldn't store the event" }, { status: 503 });
  }
}
