// Run against the DEV site (behind Vercel sign-in, so it needs the automation bypass):
//   VERCEL_BYPASS=... DEMO_PASSWORD=... node tests/e2e/dev-logins.mjs
// Signs in as every dev login and prints which pages each one can open, so access differences between roles are visible.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = process.env.MANAGE ?? "https://manage.dev.onesimplesite.co.uk", P = process.env.PORTAL ?? "https://portal.dev.onesimplesite.co.uk";
const pw = process.env.DEMO_PASSWORD, bypass = process.env.VERCEL_BYPASS;
if (!pw || !bypass) { console.error("Set DEMO_PASSWORD and VERCEL_BYPASS."); process.exit(2); }
const staff = ["abukar.sharif", "dev.director", "dev.delivery", "dev.sales", "dev.support", "dev.finance", "dev.member"];
const clients = ["portal.abukar.sharif@example.test", "portal.admin@example.test", "portal.member@example.test", "portal.viewer@example.test"];
const staffPages = ["/", "/customers", "/projects", "/agreements", "/payments", "/settings"];
const clientPages = ["/", "/projects", "/billing", "/tickets", "/people"];
const browser = await chromium.launch(); let bad = 0;

async function run(origin, who, pages) {
  const ctx = await browser.newContext({ extraHTTPHeaders: { "x-vercel-protection-bypass": bypass }, viewport: { width: 1280, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${origin}/login`);
  await page.fill("#email", who); await page.fill("#password", pw);
  await page.click("button:has-text('Sign in')");
  try { await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 20000 }); }
  catch { console.log(`FAIL  ${who}: could not sign in (${(await page.locator("[role=alert], .text-danger, .error").first().innerText().catch(() => "no message"))})`); bad++; await ctx.close(); return; }
  const row = [];
  for (const p of pages) {
    const r = await page.goto(`${origin}${p}`, { waitUntil: "domcontentloaded" });
    const path = new URL(page.url()).pathname;
    const s = r?.status() ?? 0;
    row.push(`${p}=${s >= 500 ? "ERROR " + s : path === p || (p === "/" && path === "/") ? "open" : "-> " + path}`);
    if (s >= 500) bad++;
  }
  console.log(`ok    ${who}: ${row.join("  ")}`);
  await ctx.close();
}
for (const s of staff) await run(M, s, staffPages);
for (const c of clients) await run(P, c, clientPages);
await browser.close();
console.log(bad ? `\n${bad} problem(s)` : "\nAll dev logins work.");
process.exit(bad ? 1 : 0);
