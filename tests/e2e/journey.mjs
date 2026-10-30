// Run: npm run build && npm start (port 3000) then: node tests/e2e/journey.mjs
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { readdirSync, readFileSync } from "node:fs";

const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const browser = await chromium.launch();

async function login(ctx, origin, email) {
  const page = await ctx.newPage();
  await page.goto(`${origin}/login`);
  await page.fill("#email", email); await page.fill("#password", "demo-password-123");
  await page.click("button:has-text('Sign in')");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return page;
}

const staffCtx = await browser.newContext({ viewport: { width: 1280, height: 800 } });
const staff = await login(staffCtx, M, "demo.owner@example.test");
ok(await staff.locator("h1").innerText().then((t) => t.startsWith("Today")), "staff login lands on Today");

const stamp = Date.now(); const name = "E2E Cafe " + stamp; const title = "Cafe website " + stamp;
await staff.goto(`${M}/customers/new`);
await staff.fill("#displayName", name); await staff.fill("#contactName", "Casey"); await staff.fill("#email", "casey@e2e.test");
await staff.click("button:has-text('Save enquiry')");
await staff.waitForURL(/\/customers\/[0-9a-f-]{36}$/);
ok(await staff.locator("h1").innerText() === name, "enquiry created customer");

await staff.click("a:has-text('New proposal')");
await staff.fill("#title", title); await staff.fill("#scope", "Five pages and a booking form.");
await staff.fill("#l0d", "Website build"); await staff.fill("#l0p", "1500");
await staff.fill("#l1d", "Hosting"); await staff.fill("#l1p", "25"); await staff.check("input[name=l1r]");
await staff.click("button:has-text('Save draft')");
await staff.waitForURL(/\/proposals\/[0-9a-f-]{36}$/);
await staff.click("button:has-text('Send proposal')");
await staff.waitForURL(/sent=1/);
ok(await staff.locator("text=Sent.").count() > 0, "proposal sent");

execSync(`npx tsx --env-file=.env -e "import('./src/modules/outbox/drain.ts').then(m=>m.drainOutbox()).then(r=>{console.log(JSON.stringify(r));process.exit(0)})"`, { stdio: "inherit" });
const files = readdirSync(".mail-sink").map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8"))).filter((m) => m.subject.includes(title));
ok(files.length === 1, "exactly one proposal email in sink");
const link = files[0].text.match(/https?:\/\/\S+\/p\/\S+/)[0];
ok(link.startsWith(P), "email link uses configured portal origin");

const pub = await (await browser.newContext({ viewport: { width: 375, height: 700 } })).newPage();
await pub.goto(link);
ok(await pub.locator("h1").innerText() === title, "public page renders on phone width");
const overflow = await pub.evaluate(() => document.documentElement.scrollWidth > innerWidth);
ok(!overflow, "no horizontal overflow at 375px");
await pub.fill("#name", "Casey Client"); await pub.check("input[name=consent]");
await pub.click("button:has-text('Accept proposal')");
await pub.waitForURL(/accepted$/);
ok(true, "proposal accepted");
await pub.goto(link);
ok(await pub.locator("text=no longer available").count() > 0, "used link no longer opens an acceptance form");

await staff.goto(`${M}/contracts`);
await staff.click(`a:has-text('${title}')`);
await staff.fill("#ev", "Signed PDF held in drive, signed by Casey Client");
await staff.click("button:has-text('Record completion')");
await staff.waitForURL(/\/projects\/[0-9a-f-]{36}$/);
ok(true, "completion recorded -> project created");

// Delivery role cannot see finance-ish / customer pages
const delCtx = await browser.newContext();
const del = await login(delCtx, M, "demo.delivery@example.test");
await del.goto(`${M}/proposals/new?customer=00000000-0000-0000-0000-000000000000`);
ok(del.url().endsWith("/denied"), "delivery role is denied proposal authoring");
ok((await (await del.goto(`${M}/projects`)).status()) === 200, "delivery can open projects");

// Client isolation
const a = await login(await browser.newContext(), P, "client.a@example.test");
const aText = await a.locator("main").innerText();
ok(aText.includes("Harbour Bakery") && !aText.includes("Northside"), "client A sees only own account");
await a.goto(`${P}/projects`);
const href = await a.locator("a:has-text('Harbour Bakery website')").getAttribute("href");
await a.goto(`${P}${href}`);
const body = await a.locator("main").innerText();
ok(body.includes("Kick-off complete") && !body.includes("INTERNAL") && !body.includes("margin"), "client sees client-visible updates only");
const b = await login(await browser.newContext(), P, "client.b@example.test");
const resp = await b.goto(`${P}${href}`);
ok(resp.status() === 404, "client B gets 404 for client A's project id");
const stf = await a.goto(`${P}/customers`);
ok(stf.status() === 404 || !(await a.locator("h1").innerText()).startsWith("Customers"), "portal host does not serve staff routes");
const cross = await a.goto(`${M}/portal/overview`);
ok(cross.status() === 404, "manage host refuses portal routes");
await browser.close();
console.log("ALL OK");
