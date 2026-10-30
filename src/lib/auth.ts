import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { db } from "./db";
import { env } from "./env";

/**
 * Two Better Auth instances share the user directory but use different
 * cookie namespaces and base paths. Staff access additionally requires an
 * active StaffMembership (checked server-side in requireStaff), and client
 * access requires a ClientMembership (requireClient).
 * Public sign-up is disabled; accounts are created only by accept-invitation.
 */
function make(ns: "staff" | "portal", allowSignUp: boolean) {
  const e = env();
  return betterAuth({
    appName: "OneSimpleSite",
    baseURL: ns === "staff" ? e.MANAGE_ORIGIN : e.PORTAL_ORIGIN,
    basePath: `/api/auth/${ns}`,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [ns === "staff" ? e.MANAGE_ORIGIN : e.PORTAL_ORIGIN],
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: { enabled: true, disableSignUp: !allowSignUp, minPasswordLength: 12, autoSignIn: false },
    advanced: { cookiePrefix: `oss-${ns}`, useSecureCookies: e.APP_ENV === "production" },
    session: { expiresIn: 60 * 60 * 12, updateAge: 60 * 30 },
    plugins: [...(ns === "staff" ? [twoFactor({ issuer: "OneSimpleSite Manage" })] : []), nextCookies()],
  });
}

// Lazy: nothing reads env at import time, so `next build` works without secrets.
const cache: Partial<Record<string, ReturnType<typeof make>>> = {};
export const staffAuth = () => (cache.staff ??= make("staff", false));
export const portalAuth = () => (cache.portal ??= make("portal", false));
/** Server-only; used exclusively after an invitation token has been validated. */
export const provisioningAuth = () => (cache.prov ??= make("staff", true));
