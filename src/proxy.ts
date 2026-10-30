import { NextResponse, type NextRequest } from "next/server";

/**
 * Exact-host routing. Hosts come from configuration, never from trusting Host for links.
 * portal host: serves /portal/* (rewritten), /p/* (public proposal) and /api/auth/portal only.
 * manage host: serves everything except /portal.
 * Unknown hosts are refused. This is defence in depth; every handler still checks permissions.
 */
const host = (u?: string) => { try { return u ? new URL(u).host : undefined; } catch { return undefined; } };

export function proxy(req: NextRequest) {
  const manage = host(process.env.MANAGE_ORIGIN ?? "http://manage.localhost:3000");
  const portal = host(process.env.PORTAL_ORIGIN ?? "http://portal.localhost:3000");
  const h = req.headers.get("host");
  const { pathname } = req.nextUrl;
  if (h === portal) {
    if (pathname.startsWith("/api/auth/portal") || pathname.startsWith("/p/") || pathname.startsWith("/s/") || pathname.startsWith("/invite/") || pathname.startsWith("/_next") || pathname.startsWith("/brand") || pathname === "/login") return NextResponse.next();
    if (pathname.startsWith("/portal")) return NextResponse.next();
    const url = req.nextUrl.clone();
    url.pathname = `/portal${pathname === "/" ? "/overview" : pathname}`;
    return NextResponse.rewrite(url);
  }
  if (h === manage) {
    if (pathname.startsWith("/portal") || pathname.startsWith("/api/auth/portal")) return new NextResponse("Not found", { status: 404 });
    return NextResponse.next();
  }
  // Non-production (e.g. a *.vercel.app preview): serve the staff app so a fresh deploy is never a blank 404.
  // Production stays strict: an unconfigured host is refused with an explanation.
  if (process.env.APP_ENV !== "production") return NextResponse.next();
  return new NextResponse(`Host "${h}" is not configured. Set MANAGE_ORIGIN and PORTAL_ORIGIN to the exact URLs this deployment is served on, and add both domains to the hosting project.`, { status: 421 });
}
export const config = { matcher: ["/((?!favicon.ico).*)"] };
