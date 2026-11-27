"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { SESSION_COOKIE, SESSION_HOURS, verifySessionValue } from "@/lib/session";
import { VESTA_ENV_COOKIE, VESTA_PROD_ROLES, type VestaEnv } from "@/lib/vesta/config";

export type VestaEnvState = { error: string | null };

export async function setVestaEnv(_prev: VestaEnvState, form: FormData): Promise<VestaEnvState> {
  const jar = await cookies();
  const session = await verifySessionValue(jar.get(SESSION_COOKIE)?.value);
  if (!session) return { error: "Your session ended. Sign in again." };
  const env: VestaEnv = form.get("env") === "prod" ? "prod" : "beta";
  if (env === "prod" && !VESTA_PROD_ROLES.includes(session.name)) {
    return { error: "Only Mark can switch Vesta to PROD." };
  }
  jar.set(VESTA_ENV_COOKIE, env, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    // PROD falls back to BETA when the session ends.
    maxAge: SESSION_HOURS * 3600,
  });
  revalidatePath("/", "layout");
  return { error: null };
}
