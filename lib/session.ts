/**
 * Minimal signed-cookie session for v0. Works in middleware (Edge) and Node.
 *
 * Fails closed: if ADMIN_PASSWORD or ADMIN_SESSION_SECRET is missing, nobody
 * can sign in. Replace with Supabase Auth + MFA and per-user accounts before
 * real borrower data (beyond voice-agent leads) is shown.
 */

export const SESSION_COOKIE = "hla_session";
export const SESSION_HOURS = 12;

const enc = new TextEncoder();

async function hmac(secret: string, value: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(value));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, "0")).join("");
}

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export function authConfigured(): boolean {
  return Boolean(process.env.ADMIN_PASSWORD && process.env.ADMIN_SESSION_SECRET && process.env.ADMIN_SESSION_SECRET.length >= 32);
}

export async function createSessionValue(name: string): Promise<string> {
  const secret = process.env.ADMIN_SESSION_SECRET!;
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const payload = `${encodeURIComponent(name)}.${exp}`;
  return `${payload}.${await hmac(secret, payload)}`;
}

export async function verifySessionValue(value: string | undefined): Promise<{ name: string } | null> {
  if (!value || !authConfigured()) return null;
  const parts = value.split(".");
  if (parts.length !== 3) return null;
  const [name, exp, sig] = parts;
  const expected = await hmac(process.env.ADMIN_SESSION_SECRET!, `${name}.${exp}`);
  if (!safeEqual(sig, expected)) return null;
  if (!(Number(exp) > Date.now())) return null;
  return { name: decodeURIComponent(name) };
}

export async function passwordMatches(input: string): Promise<boolean> {
  const expected = process.env.ADMIN_PASSWORD;
  if (!expected) return false;
  // Compare HMACs so the comparison is constant-length.
  const secret = process.env.ADMIN_SESSION_SECRET ?? "";
  return safeEqual(await hmac(secret, input), await hmac(secret, expected));
}
