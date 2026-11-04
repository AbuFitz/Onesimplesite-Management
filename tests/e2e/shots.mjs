import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000", out = process.argv[2];
const b = await chromium.launch();
for (const [name, vp] of [["d", { width: 1366, height: 860 }], ["p", { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  await pg.goto(`${M}/login`); await pg.fill("#email", "demo.owner@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  const snap = async (path, n) => { await pg.goto(`${M}${path}`); await pg.waitForLoadState("networkidle"); await pg.waitForTimeout(500); await pg.screenshot({ path: `${out}/${name}-${n}.png`, fullPage: true }); };
  await snap("/customers", "companies");
  await pg.goto(`${M}/customers`); const co = await pg.locator("a[href^='/customers/']:not([href$='new'])").first().getAttribute("href");
  await snap(co, "company"); await snap(`${co}?tab=agreements`, "company-agreements"); await snap(`${co}?tab=tickets`, "company-tickets");
  await snap("/tickets", "tickets");
  await pg.goto(`${M}/tickets`); const t = await pg.locator("a[href^='/support/']").first().getAttribute("href"); if (t) await snap(t, "ticket");
  await snap("/agreements", "agreements");
  await pg.goto(`${M}/agreements`); const a = await pg.locator("ul a[href^='/proposals/']").first().getAttribute("href"); if (a) await snap(a, "agreement");
  await snap("/tickets/new", "new-ticket"); await snap("/agreements/new", "new-agreement");
  await ctx.close();
}
await b.close();
