import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE, verifySessionValue } from "@/lib/session";

/** Every page requires a session except the login page and static assets. */
export async function middleware(req: NextRequest) {
  const session = await verifySessionValue(req.cookies.get(SESSION_COOKIE)?.value);
  if (session) return NextResponse.next();

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = req.nextUrl.pathname === "/" ? "" : `?next=${encodeURIComponent(req.nextUrl.pathname)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: ["/((?!login|api/webhooks/|api/cron/|_next/static|_next/image|favicon.ico|apple-touch-icon.png|brand/|fonts/).*)"],
};
