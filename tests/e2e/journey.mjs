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

const get = (page, path) => page.evaluate(async (u) => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, head: String.fromCharCode(...b.slice(0, 5)) }; }, path);
const drain = () => execSync(`npx tsx --env-file=.env -e "import('./src/modules/outbox/drain.ts').then(m=>m.drainOutbox(200)).then(()=>process.exit(0))"`, { stdio: "ignore" });
const sink = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));

await staff.goto(`${M}/contracts`);
await staff.click(`a:has-text('${title}')`);
await staff.waitForURL(/\/contracts\/[0-9a-f-]{36}$/);
const contractUrl = staff.url();
ok(await staff.locator("#se").inputValue() === "casey@e2e.test", "signer email prefilled from primary contact");
await staff.click("button:has-text('Send for signature')");
await staff.waitForURL(/sent=1/);
drain();
const req = sink().filter((m) => m.subject.includes(title) && m.subject.startsWith("Please review"));
ok(req.length === 1 && req[0].from.includes("contracts@onesimplesite.co.uk") && req[0].html.includes("Review and sign"), "signing request email sent once from contracts@ with HTML");
const signLink = req[0].text.match(/https?:\/\/\S+\/s\/\S+/)[0];
ok(signLink.startsWith(P), "signing link uses portal origin");

const signer = await (await browser.newContext({ viewport: { width: 375, height: 700 }, hasTouch: true })).newPage();
await signer.goto(signLink);
ok((await signer.locator("article").innerText()).includes("Five pages and a booking form."), "signer sees the contract text");
ok(!(await signer.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "signing page has no horizontal overflow at 375px");
await signer.click("button:has-text('Draw')");
const box = await signer.locator("canvas").boundingBox();
await signer.mouse.move(box.x + 20, box.y + 80); await signer.mouse.down();
for (let k = 0; k < 20; k++) await signer.mouse.move(box.x + 20 + k * 10, box.y + 40 + (k % 2) * 40);
await signer.mouse.up();
await signer.fill("#name", "Casey Client");
await signer.screenshot({ path: "/tmp/claude-0/sign-phone.png", fullPage: true });
await signer.check("input[name=consent]");
await signer.click("button:has-text('Sign and submit')");
await signer.waitForURL(/done$/);
ok(true, "signer submitted drawn signature on phone viewport");
await signer.goto(signLink);
ok(await signer.locator("text=already been signed").count() > 0, "link shows already-signed after use");

drain();
const mine = sink().filter((m) => m.subject.includes(title) || (m.text || "").includes(title));
const conf = mine.find((m) => m.subject.startsWith("Signed:"));
const notice = mine.find((m) => m.subject.startsWith("Contract signed"));
ok(conf && conf.to === "casey@e2e.test" && conf.attachments?.length === 1, "signer got confirmation email with PDF attached");
ok(notice && notice.to === "hello@onesimplesite.co.uk" && notice.attachments?.length === 1, "hello@ got internal notice with PDF attached");

await staff.goto(contractUrl);
ok(await staff.locator("text=Completed").count() > 0, "staff contract page shows completed");
const pdf = await get(staff, new URL(contractUrl).pathname + "/pdf");
ok(pdf.status === 200 && pdf.head === "%PDF-", "staff can download signed PDF");
await staff.goto(`${M}/`);
ok(await staff.locator("text=Recently signed").count() > 0, "Today lists recently signed contract");

// Portal invitation -> account -> signed document in portal
await staff.goto(`${M}/customers`); await staff.click(`a:has-text('${name}')`);
await staff.click("button:has-text('Invite to client portal')");
drain();
const inv = sink().find((m) => m.to === "casey@e2e.test" && m.subject.includes("invited you"));
ok(inv, "invitation email queued and sent");
const invLink = inv.text.match(/https?:\/\/\S+\/invite\/\S+/)[0];
const cl = await (await browser.newContext()).newPage();
await cl.goto(invLink); await cl.fill("#name", "Casey Client"); await cl.fill("#password", "a-long-test-password-1");
await cl.click("button:has-text('Create account')"); await cl.waitForURL(/login/);
await cl.fill("#email", "casey@e2e.test"); await cl.fill("#password", "a-long-test-password-1"); await cl.click("button:has-text('Sign in')");
await cl.waitForURL((u) => !u.pathname.startsWith("/login"));
await cl.goto(`${P}/documents`);
ok(await cl.locator(`text=${title}`).count() > 0 && await cl.locator("text=signed").count() > 0, "signed contract appears in client portal");
const dl = await get(cl, `/documents/${contractUrl.split("/").pop()}/pdf`);
ok(dl.status === 200 && dl.head === "%PDF-", "client can download signed PDF");
const other = await login(await browser.newContext(), P, "client.b@example.test");
const od = await get(other, `/documents/${contractUrl.split("/").pop()}/pdf`);
ok(od.status === 404, "another client cannot download it");

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
