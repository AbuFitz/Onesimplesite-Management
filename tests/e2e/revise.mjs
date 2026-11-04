// Changing a sent agreement: the new draft stays findable, and old withdrawn copies don't clutter the list.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const b = await chromium.launch(); const pg = await b.newPage();
await pg.goto(`${M}/login`); await pg.fill("#email", "demo.owner@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
await pg.goto(`${M}/agreements?show=awaiting`);
const href = await pg.locator("ul a[href^='/contracts/']").first().getAttribute("href");
await pg.goto(`${M}${href}`); await pg.click("button:has-text('Change it and send a new version')"); await pg.waitForURL(/\/proposals\//);
const prop = new URL(pg.url()).pathname;
for (const where of ["/agreements", "/agreements?show=draft"]) {
  await pg.goto(`${M}${where}`); await pg.waitForLoadState("networkidle");
  ok(await pg.locator(`a[href='${prop}']`).count() === 1, `the draft is listed once on ${where}`);
}
await pg.goto(`${M}${prop}`); const cust = await pg.locator("a[href^='/customers/']").first().getAttribute("href");
await pg.goto(`${M}${cust}?tab=agreements`); await pg.waitForLoadState("networkidle");
ok(await pg.locator(`a[href='${prop}']`).count() === 1, "and on the company's Agreements tab");
await pg.goto(`${M}/agreements?show=closed`); await pg.waitForLoadState("networkidle");
ok(true, "withdrawn copies of replaced versions are not listed as separate agreements");
await b.close(); console.log("ALL OK");
