/**
 * Vesta environment (BETA or PROD) for server-side calls.
 *
 * Auth follows the Pro Portal (skramco-uff-pro lib/vesta-mismo-client.ts):
 *   Authorization: Token <token>
 *   X-Api-Version: <version>
 *
 * Each environment has its own URL and token so a BETA token can never be
 * sent to PROD by mistake. The selected environment lives in an HttpOnly
 * cookie and defaults to BETA. Only Mark can switch to PROD.
 */

import { cookies } from "next/headers";

export type VestaEnv = "beta" | "prod";
export const VESTA_ENV_COOKIE = "hla_vesta_env";
export const VESTA_PROD_ROLES = ["Mark"];

const DEFAULT_BETA_URL = "https://uff.beta.vesta.com/api/v1";
const DEFAULT_API_VERSION = "26.4";

export type VestaConfig = {
  env: VestaEnv;
  baseUrl: string | null;
  token: string | null;
  apiVersion: string;
};

export function vestaConfig(env: VestaEnv): VestaConfig {
  const baseUrl =
    env === "prod" ? process.env.VESTA_PROD_API_URL || null : process.env.VESTA_BETA_API_URL || DEFAULT_BETA_URL;
  const token = (env === "prod" ? process.env.VESTA_PROD_API_TOKEN : process.env.VESTA_BETA_API_TOKEN) || null;
  return { env, baseUrl: baseUrl ? baseUrl.replace(/\/+$/, "") : null, token, apiVersion: process.env.VESTA_API_VERSION || DEFAULT_API_VERSION };
}

export function isConfigured(c: VestaConfig): boolean {
  return Boolean(c.baseUrl && c.token);
}

export async function currentVestaEnv(): Promise<VestaEnv> {
  return (await cookies()).get(VESTA_ENV_COOKIE)?.value === "prod" ? "prod" : "beta";
}

/** Status for the UI. Never includes the token itself. */
export async function vestaStatus() {
  const env = await currentVestaEnv();
  const beta = vestaConfig("beta");
  const prod = vestaConfig("prod");
  return {
    env,
    apiVersion: process.env.VESTA_API_VERSION || DEFAULT_API_VERSION,
    beta: { configured: isConfigured(beta), host: beta.baseUrl ? new URL(beta.baseUrl).host : null },
    prod: { configured: isConfigured(prod), host: prod.baseUrl ? new URL(prod.baseUrl).host : null },
  };
}
export type VestaStatus = Awaited<ReturnType<typeof vestaStatus>>;

/**
 * Call Vesta in the currently selected environment.
 * `path` is relative to the API base, e.g. "/loans/123".
 */
export async function vestaFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const c = vestaConfig(await currentVestaEnv());
  if (!isConfigured(c)) {
    throw new Error(`Vesta ${c.env.toUpperCase()} is not configured. Add its URL and token in Netlify.`);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Token ${c.token}`);
  headers.set("X-Api-Version", c.apiVersion);
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${c.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers, cache: "no-store" });
}
