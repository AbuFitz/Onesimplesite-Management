// Agreements area: separate from tickets, one open agreement per company, works on a phone.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const M = "http://manage.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
// the demo workspace needs a care plan to choose from, as the live one has
writeFileSync("seed-plan.tmp.ts", `import { db } from "@/lib/db";
const m = await db.staffMembership.findFirstOrThrow({ where: { email: "demo.owner@example.test" } });
if (!(await db.servicePlan.findFirst({ where: { workspaceId: m.workspaceId, active: true } }))) await db.servicePlan.create({ data: { workspaceId: m.workspaceId, key: "standard", name: "Standard Care Plan", kind: "standard", monthlyMinor: 2900 } });
process.exit(0);`);
execSync("npx tsx --env-file=.env seed-plan.tmp.ts", { stdio: "ignore" }); rmSync("seed-plan.tmp.ts");
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
await pg.goto(first.split("?")[0] + "?step=5"); await pg.click("text=Preview what they will see"); await pg.waitForURL(/\/preview$/);
ok(await pg.locator("text=Nothing has been sent").count() === 1, "preview says nothing has been sent");
ok((await pg.locator("article").first().innerText()).toLowerCase().includes("the project"), "preview shows the agreement document");
ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "preview has no horizontal overflow on a phone");
const pdf = await pg.evaluate(async (u) => { const r = await fetch(u); const t = new Uint8Array(await r.arrayBuffer()); return { s: r.status, h: String.fromCharCode(...t.slice(0, 5)) }; }, first.split("?")[0] + "/preview/pdf");
ok(pdf.s === 200 && pdf.h === "%PDF-", "PDF preview downloads");
// A hosting-only job fills itself in: care plan chosen, price line named for the job, and a plain summary that updates as you type
await pg.goto(`${M}/agreements/new?business=${biz}`); await pg.waitForLoadState("networkidle");
await pg.goto(`${M}/agreements/new?business=${biz}&another=1`);
{
  const first2 = pg.url();
  await pg.goto(`${M}/customers/new`); const name2 = `Care ${Date.now()}`;
  await pg.fill("#rb-n", name2); await pg.selectOption("#rb-t", "Food and drink"); await pg.fill("input[name=town]", "Leeds"); await pg.fill("#rc-n", "Dee Lee"); await pg.fill("#rc-e", `dee${Date.now()}@guard.test`);
  await pg.click("button:has-text('Add company and start an agreement')"); await pg.waitForURL(/\/agreements\/new\?business=/);
  await pg.selectOption("#ag-w", "care"); await pg.click("button:has-text('Start the agreement')"); await pg.waitForURL(/\/proposals\/[0-9a-f-]{36}/);
  await pg.click("button:has-text('Save and continue')"); await pg.waitForURL(/step=2/);
  ok(await pg.locator("input[name=l0d]").inputValue() === "Hosting set-up and move-over", "a hosting-only job names its price line for the job");
  ok((await pg.locator("#plan").inputValue()) !== "", "and the care plan is already chosen");
  const sum = await pg.locator("[aria-label='What the customer will pay']").innerText();
  ok(/a month, starting when the site goes live/.test(sum), "the summary says what the customer pays each month, and when it starts");
  await pg.fill("input[name=l0p]", "100");
  await pg.click("button:has-text('Save and continue')"); await pg.waitForURL(/step=3/);
  await pg.selectOption("#dp", "50");
  ok(/£50\.00 when they sign \(50% deposit\), then £50\.00 before the site goes live/.test(await pg.locator("[aria-label='What the customer will pay']").innerText()), "the summary updates live as the deposit is chosen");
  await pg.selectOption("#pfm", "1"); await pg.selectOption("#pfe", "stop");
  ok(/free for 1 month from the day the site goes live, then it simply ends/.test(await pg.locator("[aria-label='What the customer will pay']").innerText()), "and explains a free month that simply ends");
  // going back keeps what was typed, and the review shows it all
  await pg.click("button:has-text('Back')"); await pg.waitForURL(/step=2/);
  ok(await pg.locator("input[name=l0p]").inputValue() === "100.00", "going back keeps what was saved");
  await pg.click("button:has-text('Save and continue')"); await pg.waitForURL(/step=3/); await pg.click("button:has-text('Save and continue')"); await pg.waitForURL(/step=4/); await pg.click("button:has-text('Save and review')"); await pg.waitForURL(/step=5/);
  const review = await pg.locator("main").innerText();
  ok(/Deposit £50\.00 \(50%\) when they sign, then £50\.00 before the site goes live/.test(review) && /Offer/.test(review), "the review step shows the price, deposit and offer in plain words");
  ok(await pg.locator("a:has-text('Change')").count() >= 4, "each part of the review has a Change link back to its step");
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "the form fits a phone");
  void first2;
}
await b.close(); console.log("ALL OK");
