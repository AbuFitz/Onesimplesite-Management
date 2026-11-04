import { NextResponse, type NextRequest } from "next/server";

/**
 * Exact-host routing. Hosts come from configuration, never from trusting Host for links.
 * portal host: serves /portal/* (rewritten), /p/* (public proposal), /s/* (signing) and /api/auth/portal only.
 * manage host: serves everything except /portal.
 * Unknown hosts are refused. This is defence in depth; every handler still checks permissions.
 */
const host = (u?: string) => { try { return u ? new URL(u).host : undefined; } catch { return undefined; } };

/** A random id for this browser, so we can tell a new device from one we know. It identifies nothing about the person. */
function withDevice(req: NextRequest, res: NextResponse) {
  if (!req.cookies.get("oss_did")) res.cookies.set("oss_did", crypto.randomUUID(), { httpOnly: true, sameSite: "lax", secure: process.env.APP_ENV === "production", maxAge: 60 * 60 * 24 * 400, path: "/" });
  return res;
}

export function proxy(req: NextRequest) {
  // Remember the address the person actually asked for (before any internal rewrite) so sign-in can bring them back to it.
  const hdrs = new Headers(req.headers);
  hdrs.set("x-next-path", req.nextUrl.pathname + req.nextUrl.search);
  return withDevice(req, route(req, hdrs));
}

function route(req: NextRequest, hdrs: Headers): NextResponse {
  const manage = host(process.env.MANAGE_ORIGIN ?? "http://manage.localhost:3000");
  const portal = host(process.env.PORTAL_ORIGIN ?? "http://portal.localhost:3000");
  const h = req.headers.get("host");
  const { pathname } = req.nextUrl;
  if (h === portal) {
    if (pathname.startsWith("/api/auth/portal") || pathname.startsWith("/p/") || pathname.startsWith("/s/") || pathname.startsWith("/invite/") || pathname.startsWith("/legal/") || pathname.startsWith("/_next") || pathname.startsWith("/brand") || /^\/(icon|apple-icon|favicon)(\.|$)/.test(pathname) || pathname === "/manifest.webmanifest" || /^\/icon-[\w-]+\.png$/.test(pathname) || pathname === "/login" || pathname === "/setup-security" || pathname === "/forgot-password" || pathname === "/reset-password") return NextResponse.next({ request: { headers: hdrs } });
    if (pathname.startsWith("/portal")) return NextResponse.next({ request: { headers: hdrs } });
    const url = req.nextUrl.clone();
    url.pathname = `/portal${pathname === "/" ? "/overview" : pathname}`;
    return NextResponse.rewrite(url, { request: { headers: hdrs } });
  }
  if (h === manage) {
    if (pathname.startsWith("/portal") || pathname.startsWith("/api/auth/portal")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next({ request: { headers: hdrs } });
  }
  // Non-production (e.g. a *.vercel.app preview): serve the staff app so a fresh deploy is never a blank 404.
  // Production stays strict: an unconfigured host is refused with an explanation.
  if (process.env.APP_ENV !== "production") return NextResponse.next({ request: { headers: hdrs } });
  return new NextResponse(`Host "${h}" is not configured. Set MANAGE_ORIGIN and PORTAL_ORIGIN to the exact URLs this deployment is served on, and add both domains to the hosting project.`, { status: 421 });
}
export const config = { matcher: ["/((?!favicon.ico).*)"] };
