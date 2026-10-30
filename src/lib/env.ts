import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  MANAGE_ORIGIN: z.url().default("http://manage.localhost:3000"),
  PORTAL_ORIGIN: z.url().default("http://portal.localhost:3000"),
  APP_ENV: z.enum(["development", "staging", "production", "test"]).default("development"),
  BETTER_AUTH_SECRET: z.string().min(32),
  // Pasted keys often carry a trailing newline, quotes or invisible characters, which make the Authorization header invalid.
  RESEND_API_KEY: z.string().optional().transform((v) => { const k = v?.replace(/[^A-Za-z0-9_-]/g, ""); return k || undefined; }),
  MAIL_ALLOWLIST: z.string().optional(),
});

let cached: z.infer<typeof schema> | undefined;
export function env() {
  return (cached ??= schema.parse(process.env));
}

/** Canonical links come from configuration, never from the request Host header. */
export const origins = () => ({ manage: env().MANAGE_ORIGIN, portal: env().PORTAL_ORIGIN });
export const portalLink = (path: string) => new URL(path, env().PORTAL_ORIGIN).toString();
export const manageLink = (path: string) => new URL(path, env().MANAGE_ORIGIN).toString();

export const internalNoticeTo = () => process.env.INTERNAL_NOTICE_TO ?? "hello@onesimplesite.co.uk";
