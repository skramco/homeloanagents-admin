"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE, SESSION_HOURS, authConfigured, createSessionValue, passwordMatches } from "@/lib/session";

const NAMES = ["Mark", "Processor 1", "Processor 2", "Lorinn"];

export type LoginState = { error: string | null; next?: string };

export async function login(_prev: LoginState, form: FormData): Promise<LoginState> {
  if (!authConfigured()) {
    return { error: "Sign-in is not set up yet. Add ADMIN_PASSWORD and ADMIN_SESSION_SECRET in Netlify." };
  }
  const name = String(form.get("name") ?? "");
  const password = String(form.get("password") ?? "");
  const next = String(form.get("next") ?? "/");
  if (!NAMES.includes(name) || !(await passwordMatches(password))) {
    // Small delay to slow down guessing.
    await new Promise((r) => setTimeout(r, 600));
    return { error: "That name and password don’t match." };
  }
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionValue(name), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
  // Full page load (not a client redirect) so middleware sees the new cookie.
  return { error: null, next: next.startsWith("/") && !next.startsWith("//") ? next : "/" };
}

export async function logout() {
  const jar = await cookies();
  jar.delete(SESSION_COOKIE);
  redirect("/login");
}
