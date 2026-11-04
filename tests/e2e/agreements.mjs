// Agreements area: separate from tickets, one open agreement per company, works on a phone.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 375, height: 800 } });
const pg = await ctx.newPage();
await pg.goto(`${M}/login`); await pg.fill("#email", "demo.owner@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
await pg.goto(`${M}/agreements`); await pg.waitForLoadState("networkidle");
ok(await pg.locator("h1:has-text('Agreements')").count() === 1, "agreements page loads");
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "no horizontal overflow on a phone");
const opts = await pg.locator("#show option").allInnerTexts();
ok(opts.some((o) => o.startsWith("Signed")) && opts.some((o) => o.startsWith("Waiting for signature")), "has its own Signed and Waiting tabs");
await pg.goto(`${M}/tickets`); await pg.waitForLoadState("networkidle");
ok(!(await pg.locator("#type option").allInnerTexts()).some((o) => o.startsWith("New website")), "tickets no longer include New website");
await pg.goto(`${M}/contracts`); ok(pg.url().endsWith("/agreements"), "old contracts list lands on Agreements");
// one open agreement per company: starting a second one opens the first
await pg.goto(`${M}/customers/new`); await pg.waitForLoadState("networkidle");
const name = `Guard ${Date.now()}`;
await pg.fill("#rb-n", name); await pg.selectOption("#rb-t", "Food and drink"); await pg.fill("input[name=town]", "Leeds"); await pg.fill("#rc-n", "Pat Lee"); await pg.fill("#rc-e", `pat${Date.now()}@guard.test`);
await pg.click("button:has-text('Add company and start an agreement')"); await pg.waitForURL(/\/agreements\/new\?business=/);
const biz = new URL(pg.url()).searchParams.get("business");
await pg.click("button:has-text('Start the agreement')"); await pg.waitForURL(/\/proposals\/[0-9a-f-]{36}/);
const first = pg.url();
await pg.goto(`${M}/agreements/new?business=${biz}`); await pg.click("button:has-text('Start the agreement')"); await pg.waitForURL(/existing=1/);
ok(pg.url().split("?")[0] === first.split("?")[0], "a second agreement for the same company opens the first instead");
ok(await pg.locator("text=already has an agreement in progress").count() === 1, "and says why");
// Preview before sending: the real agreement, a PDF, and nothing sent
await pg.goto(first.split("?")[0]); await pg.click("text=Preview what they will see"); await pg.waitForURL(/\/preview$/);
ok(await pg.locator("text=Nothing has been sent").count() === 1, "preview says nothing has been sent");
ok((await pg.locator("article").first().innerText()).toLowerCase().includes("the project"), "preview shows the agreement document");
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "preview has no horizontal overflow on a phone");
const pdf = await pg.evaluate(async (u) => { const r = await fetch(u); const t = new Uint8Array(await r.arrayBuffer()); return { s: r.status, h: String.fromCharCode(...t.slice(0, 5)) }; }, first.split("?")[0] + "/preview/pdf");
ok(pdf.s === 200 && pdf.h === "%PDF-", "PDF preview downloads");
await b.close(); console.log("ALL OK");
