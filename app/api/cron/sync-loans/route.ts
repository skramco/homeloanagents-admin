/**
 * Refreshes the HLA loan list from the HLA pipeline view (one Vesta call per page of 50).
 * Called every 15 minutes by netlify/functions/sync-hla-loans.mts with CRON_SECRET.
 */

import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { saveHlaLoans } from "@/lib/hla-loans";
import { loadVestaPipelineFor } from "@/lib/vesta/pipeline";

export const dynamic = "force-dynamic";

function authorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  const given = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  if (!secret || given.length !== secret.length) return false;
  return timingSafeEqual(Buffer.from(given), Buffer.from(secret));
}

export async function POST(req: Request) {
  if (!authorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const env = process.env.VESTA_WEBHOOK_ENV === "prod" ? "prod" : "beta";
  const vesta = await loadVestaPipelineFor(env);
  if (vesta.error) return NextResponse.json({ ok: false, error: vesta.error }, { status: 502 });
  const r = await saveHlaLoans(env, vesta.loans);
  return NextResponse.json(r, { status: r.ok ? 200 : 500 });
}
