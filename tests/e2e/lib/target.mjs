// Where the end-to-end suites run, and the few set-up jobs they need from the server.
//   Local (default):  a local `next start` on manage.localhost:3000, with CRON_SECRET set to anything (the same value in the server and here).
//   The dev site:     E2E_TARGET=dev VERCEL_BYPASS=... CRON_SECRET=... DEMO_PASSWORD=... node tests/e2e/<suite>.mjs
// Both go through the server's /api/dev/hooks (never straight to the database), so a suite behaves the same in either place.
import { createRequire } from "node:module";
import { readdirSync, readFileSync, rmSync, existsSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");

export const REMOTE = process.env.E2E_TARGET === "dev";
export const M = REMOTE ? (process.env.MANAGE ?? "https://manage.dev.onesimplesite.co.uk") : "http://manage.localhost:3000";
export const P = REMOTE ? (process.env.PORTAL ?? "https://portal.dev.onesimplesite.co.uk") : "http://portal.localhost:3000";
export const PW = REMOTE ? process.env.DEMO_PASSWORD : "demo-password-123";
const BYPASS = process.env.VERCEL_BYPASS, CRON = process.env.CRON_SECRET ?? "local-test-secret";
if (REMOTE && (!BYPASS || !PW || !process.env.CRON_SECRET)) { console.error("The dev site needs VERCEL_BYPASS, DEMO_PASSWORD and CRON_SECRET."); process.exit(2); }

/** A browser; on the dev site every request carries the protection bypass. */
export async function launch() {
  const b = await chromium.launch();
  if (REMOTE) { const nc = b.newContext.bind(b); b.newContext = (o = {}) => nc({ ...o, extraHTTPHeaders: { ...(o.extraHTTPHeaders ?? {}), "x-vercel-protection-bypass": BYPASS } }); }
  return b;
}
export { chromium };

export async function hook(action, args = {}) {
  // Node cannot look up *.localhost names (browsers can), so locally go to 127.0.0.1 and name the site in the Host header.
  const url = REMOTE ? `${M}/api/dev/hooks` : "http://127.0.0.1:3000/api/dev/hooks";
  const r = await fetch(url, { method: "POST", headers: { authorization: `Bearer ${CRON}`, "content-type": "application/json", ...(REMOTE ? { "x-vercel-protection-bypass": BYPASS } : { host: new URL(M).host }) }, body: JSON.stringify({ action, ...args }) });
  const text = await r.text();
  if (!r.ok) throw new Error(`hook ${action} failed (${r.status}): ${text.slice(0, 300)}`);
  return JSON.parse(text);
}
export const drain = () => hook("drain");
export const resetProfile = () => hook("reset-profile");
export const ensurePlan = () => hook("ensure-plan");
export const ensureTicket = () => hook("ensure-ticket");
export const seedOrder = (kind) => hook("order", { kind });
export const securityMode = (codes, testers = "") => hook("security-mode", { codes, testers });

/** The emails the app has "sent": a local folder here, the dev database on the dev site. */
export async function sink() {
  if (REMOTE) return hook("mail");
  if (!existsSync(".mail-sink")) return [];
  return readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));
}
export async function clearSink() { if (REMOTE) await hook("clear-mail"); else rmSync(".mail-sink", { recursive: true, force: true }); }

/** The demo company (client.b) and its first project: the command line can still override them. */
export const ids = () => hook("ids");
