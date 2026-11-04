import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import { twoFactor } from "better-auth/plugins";
import { passkey } from "@better-auth/passkey";
import { db } from "./db";
import { env } from "./env";

/**
 * Two Better Auth instances share the user directory but use different
 * cookie namespaces and base paths. Staff access additionally requires an
 * active StaffMembership (checked server-side in requireStaff), and client
 * access requires a ClientMembership (requireClient).
 * Public sign-up is disabled; accounts are created only by accept-invitation.
 */
/** The parent domain both sites share (onesimplesite.co.uk, or localhost in development), so one passkey works on the team app and the portal. */
export function passkeyDomain(a: string, b: string) {
  const x = new URL(a).hostname.split(".").reverse(), y = new URL(b).hostname.split(".").reverse(), out: string[] = [];
  for (let i = 0; i < Math.min(x.length, y.length) && x[i] === y[i]; i++) out.push(x[i]);
  return out.reverse().join(".") || new URL(a).hostname;
}

/** Live: the shared parent domain. In development there is no shared parent ("localhost" is not accepted), so each site uses its own host. */
export const passkeyRpId = (a: string, b: string, own: string) => { const common = passkeyDomain(a, b); return common.includes(".") ? common : new URL(own).hostname; };

async function sendLoginCode(user: { email: string; name: string }, code: string) {
  const { renderEmail } = await import("@/emails/templates");
  const { sendMail } = await import("./mail");
  const { fmtFrom } = await import("./sender-identities");
  const r = await renderEmail("login_code", { to: user.email, name: user.name, code, minutes: 10 });
  await sendMail({ from: fmtFrom("noreply"), to: user.email, subject: r.subject, html: r.html, text: r.text });
}

function make(ns: "staff" | "portal", allowSignUp: boolean) {
  const e = env();
  return betterAuth({
    appName: "OneSimpleSite",
    baseURL: ns === "staff" ? e.MANAGE_ORIGIN : e.PORTAL_ORIGIN,
    basePath: `/api/auth/${ns}`,
    secret: e.BETTER_AUTH_SECRET,
    trustedOrigins: [ns === "staff" ? e.MANAGE_ORIGIN : e.PORTAL_ORIGIN],
    database: prismaAdapter(db, { provider: "postgresql" }),
    emailAndPassword: {
      enabled: true, disableSignUp: !allowSignUp, minPasswordLength: 12, autoSignIn: false,
      resetPasswordTokenExpiresIn: 60 * 60,
      revokeSessionsOnPasswordReset: true,
      // Needs RESEND_API_KEY in production; the forgot-password screen says so when it is missing.
      onPasswordReset: async ({ user }) => {
        try {
          const { renderEmail } = await import("@/emails/templates");
          const { sendMail } = await import("./mail");
          const { fmtFrom } = await import("./sender-identities");
          const when = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeStyle: "short", timeZone: "Europe/London" }).format(new Date());
          const r = await renderEmail("password_changed", { to: user.email, name: user.name, when });
          await sendMail({ from: fmtFrom("noreply"), to: user.email, subject: r.subject, html: r.html, text: r.text });
        } catch { /* a failed notice must never block the reset itself */ }
      },
      sendResetPassword: async ({ user, url }) => {
        const { renderEmail } = await import("@/emails/templates");
        const { sendMail } = await import("./mail");
        const { fmtFrom } = await import("./sender-identities");
        const r = await renderEmail("password_reset", { to: user.email, name: user.name, link: url, minutes: 60 });
        await sendMail({ from: fmtFrom("noreply"), to: user.email, subject: r.subject, html: r.html, text: r.text });
      },
    },
    advanced: { cookiePrefix: `oss-${ns}`, useSecureCookies: e.APP_ENV === "production" },
    // "Keep me signed in" ticked: the full length below. Not ticked: a one-day session that ends when the browser closes.
    session: { expiresIn: 60 * 60 * 24 * (ns === "staff" ? 14 : 30), updateAge: 60 * 60 * 24 },
    plugins: [
      // Authenticator app (TOTP) or an emailed one-time code, with "trust this device" for 30 days so it is not asked every time.
      twoFactor({ issuer: ns === "staff" ? "OneSimpleSite Manage" : "OneSimpleSite", trustDeviceMaxAge: 60 * 60 * 24 * 30, otpOptions: { period: 10, allowedAttempts: 5, sendOTP: ({ user, otp }) => sendLoginCode(user, otp) } }),
      passkey({ rpID: passkeyRpId(e.MANAGE_ORIGIN, e.PORTAL_ORIGIN, ns === "staff" ? e.MANAGE_ORIGIN : e.PORTAL_ORIGIN), rpName: "OneSimpleSite", origin: [e.MANAGE_ORIGIN, e.PORTAL_ORIGIN] }),
      nextCookies(),
    ],
  });
}

// Lazy: nothing reads env at import time, so `next build` works without secrets.
const cache: Partial<Record<string, ReturnType<typeof make>>> = {};
export const staffAuth = () => (cache.staff ??= make("staff", false));
export const portalAuth = () => (cache.portal ??= make("portal", false));
/** Server-only; used exclusively after an invitation token has been validated. */
export const provisioningAuth = () => (cache.prov ??= make("staff", true));
