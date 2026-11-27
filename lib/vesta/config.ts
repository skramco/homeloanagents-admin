/**
 * Vesta environment (BETA or PROD) for server-side calls.
 *
 * Auth and endpoints follow pro-api (SK.Pro.Integrations.LOS/Vesta):
 *   Authorization: Token <token>
 *   X-Api-Version: <version>
 *   X-Vesta-Request-Context: <caller name>
 *
 * Each environment has its own URL and token so a BETA token can never be
 * sent to PROD by mistake. The selected environment lives in an HttpOnly
 * cookie and defaults to BETA. Only Mark can switch to PROD.
 */

import { cookies } from "next/headers";

export type VestaEnv = "beta" | "prod";
export const VESTA_ENV_COOKIE = "hla_vesta_env";
export const VESTA_PROD_ROLES = ["Mark"];

const DEFAULTS = {
  beta: {
    url: "https://uff.beta.vesta.com/api/v1",
    // Vesta admin user that pipeline queries run as (pro-api appsettings.json).
    userId: "6db9be88-0160-4a4b-8910-b0a14944f7ae",
    // HLA retail pipeline view Mark created in BETA on 2026-11-27.
    pipelineViewId: "fbbb992f-7e0d-4e76-bc94-f8a4120bd905",
  },
  prod: {
    url: "https://uff.vesta.com/api/v1",
    userId: "0195d96c-2c76-7ca7-9cc8-455f328aa2c5",
    // No PROD HLA view yet: set VESTA_PROD_PIPELINE_VIEW_ID once it exists.
    pipelineViewId: "",
  },
} as const;
const DEFAULT_API_VERSION = "26.4";

export type VestaConfig = {
  env: VestaEnv;
  baseUrl: string | null;
  token: string | null;
  apiVersion: string;
  userId: string;
  pipelineViewId: string | null;
};

export function vestaConfig(env: VestaEnv): VestaConfig {
  const e = env === "prod" ? process.env.VESTA_PROD_API_URL : process.env.VESTA_BETA_API_URL;
  const P = env === "prod" ? "VESTA_PROD_" : "VESTA_BETA_";
  const d = DEFAULTS[env];
  const baseUrl = (e || d.url).replace(/\/+$/, "");
  return {
    env,
    baseUrl,
    token: process.env[`${P}API_TOKEN`] || null,
    apiVersion: process.env.VESTA_API_VERSION || DEFAULT_API_VERSION,
    userId: process.env[`${P}USER_ID`] || d.userId,
    pipelineViewId: process.env[`${P}PIPELINE_VIEW_ID`] || d.pipelineViewId || null,
  };
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
export async function vestaFetch(path: string, init: RequestInit = {}, env?: VestaEnv): Promise<Response> {
  const c = vestaConfig(env ?? (await currentVestaEnv()));
  if (!isConfigured(c)) {
    throw new Error(`Vesta ${c.env.toUpperCase()} is not configured. Add its URL and token in Netlify.`);
  }
  const headers = new Headers(init.headers);
  headers.set("Authorization", `Token ${c.token}`);
  headers.set("X-Api-Version", c.apiVersion);
  headers.set("X-Vesta-Request-Context", "HLA-Admin");
  if (!headers.has("Accept")) headers.set("Accept", "application/json");
  return fetch(`${c.baseUrl}${path.startsWith("/") ? path : `/${path}`}`, { ...init, headers, cache: "no-store" });
}
