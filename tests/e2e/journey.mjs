// Full journey in a real browser: Settings -> Terms -> customer details -> proposal with requirements ->
// ONE agreement email -> customer signs on a phone -> confirmation emails -> portal. Run against `next start`.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";

const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const get = (page, path) => page.evaluate(async (u) => { const r = await fetch(u); const b = new Uint8Array(await r.arrayBuffer()); return { status: r.status, head: String.fromCharCode(...b.slice(0, 5)) }; }, path);
const drain = () => execSync(`npx tsx --env-file=.env -e "import('./src/modules/outbox/drain.ts').then(m=>m.drainOutbox(200)).then(()=>process.exit(0))"`, { stdio: "ignore" });
const sink = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));
rmSync(".mail-sink", { recursive: true, force: true });

const browser = await chromium.launch();
async function login(ctx, origin, email) {
  const page = await ctx.newPage();
  await page.goto(`${origin}/login`);
  await page.fill("#email", email); await page.fill("#password", "demo-password-123");
  await page.click("button:has-text('Sign in')");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return page;
}
const stamp = Date.now(), name = `E2E Bakery ${stamp}`, title = `Website with bookings for E2E Bakery ${stamp}`, email = `casey.${stamp}@e2e.test`;
const staff = await login(await browser.newContext({ viewport: { width: 1280, height: 900 } }), M, "demo.owner@example.test");

// 0. My account: first-time profile banner, job title, signature with live preview
execSync(`npx tsx --env-file=.env -e "import('./src/lib/db.ts').then(({db})=>db.staffMembership.updateMany({where:{email:'demo.owner@example.test'},data:{jobTitle:null,signature:null}})).then(()=>process.exit(0))"`, { stdio: "ignore" });
await staff.goto(`${M}/`);
ok((await staff.locator("a[href='/account']").first().innerText()).includes("Finish setting up your profile"), "new members see the finish-your-profile banner");
await staff.click("a:has-text('Finish setting up your profile')"); await staff.waitForURL(/\/account/);
await staff.fill("#pf-title", "Director"); await staff.click("button:has-text('Write one for me')");
ok((await staff.locator("main").innerText()).includes("Director"), "signature preview updates live");
await staff.click("button:has-text('Save profile')"); await staff.waitForSelector("text=Saved.");
await staff.goto(`${M}/`);
ok(await staff.locator("text=Finish setting up your profile").count() === 0, "banner disappears once the profile is complete");

// 0b. Notes autosave and calendar quick-add
await staff.goto(`${M}/notes`); await staff.click("button:has-text('New page')"); await staff.waitForURL(/\/notes\/[0-9a-f-]{36}/);
await staff.fill("#np-title", "Kick-off notes"); await staff.fill("#np-body", "# Plan\n- [ ] Call the customer");
await staff.waitForSelector("[role=status]:has-text('Saved')", { timeout: 8000 });
await staff.reload();
ok((await staff.locator("main").innerText()).includes("Call the customer"), "note saved itself without pressing save");
await staff.click("input[type=checkbox]"); await staff.waitForSelector("[role=status]:has-text('Saved')", { timeout: 8000 }); await staff.reload();
ok(await staff.locator("input[type=checkbox]").isChecked(), "ticking a to-do is saved");
await staff.goto(`${M}/calendar`); await staff.fill("#qe-t", "Team sync"); await staff.click("form button:has-text('Add event')"); await staff.waitForURL(/day=/);
ok((await staff.locator("main").innerText()).includes("Team sync"), "calendar quick-add shows the event on the day");

// 1. Settings: company details
await staff.goto(`${M}/settings`);
await staff.fill("#legalName", "OneSimpleSite Ltd"); await staff.fill("#companyNumber", "01234567"); await staff.fill("#registeredAddress", "1 High Street, London");
await staff.click("button:has-text('Save company details')"); await staff.waitForURL(/saved=1/);
ok(true, "company details saved in Settings");

// 2. Terms: starter has placeholders -> publish blocked -> write real terms -> publish
await staff.goto(`${M}/settings/terms`);
await staff.click("main ul a >> nth=0"); await staff.waitForURL(/\/settings\/legal\/terms\/[0-9a-f-]{36}/);
if (await staff.locator("button:has-text('Publish version')").count()) {
  ok(await staff.locator("button:has-text('Publish version')").isDisabled(), "publish is blocked while [TBC] placeholders remain");
  const clauses = staff.locator("textarea[aria-label^='Clause']");
  for (let k = 0, n = await clauses.count(); k < n; k++) await clauses.nth(k).fill("The Provider and the Client will act reasonably and in line with the Order Summary.");
  await staff.click("button:has-text('Save draft')"); await staff.waitForURL(/saved=1/);
  await staff.click("button:has-text('Publish version')"); await staff.waitForURL(/published=1/);
}
await staff.goto(`${M}/settings/terms`);
ok(await staff.locator("text=Live: ").count() > 0, "terms published");

// 3. Enquiry -> customer details -> proposal with requirements
await staff.goto(`${M}/settings/legal`);
ok((await staff.locator("main li h3").allInnerTexts()).join("|") === ["Terms and Conditions", "Privacy Notice", "Cookie Notice", "Website Terms", "Data Processing Agreement", "Change Request"].join("|"), "all six legal documents are listed");
await staff.goto(`${M}/settings/legal/privacy`); await staff.click("main ul a >> nth=0"); await staff.waitForURL(/\/legal\/privacy\/[0-9a-f-]{36}/);
ok((await staff.locator("article").first().innerText()).includes("Privacy Notice"), "privacy notice preview renders in the document layout");
ok(await staff.locator("button:has-text('Publish version')").isDisabled(), "privacy notice can't be published while decisions are open");
await staff.goto(`${M}/settings/emails?e=signing_confirmation&w=phone`);
ok(await staff.locator("iframe").count() === 1 && (await staff.locator("main").innerText()).includes("Signed copy"), "email preview page renders the customer emails");
await staff.goto(`${M}/settings/terms`); await staff.click("main ul a >> nth=0"); await staff.waitForURL(/\/settings\/legal\/terms\/[0-9a-f-]{36}/);
const termsUrl = staff.url().split("?")[0];
await staff.goto(`${termsUrl}/preview`);
ok((await staff.locator("article").first().innerText()).includes("Order summary".toUpperCase()) || (await staff.locator("article").first().innerText()).toLowerCase().includes("order summary"), "full document preview shows the whole agreement");
ok((await get(staff, `${termsUrl}/sample.pdf`)).head === "%PDF-", "sample PDF downloads");
await staff.goto(`${M}/?new=ticket`); await staff.waitForSelector("dialog[open]"); await staff.waitForLoadState("networkidle");
await staff.fill("#j-biz", name); await staff.fill("#j-contact", "Casey Morgan"); await staff.fill("#j-email", email);
await staff.click("dialog button:has-text('Continue')");
await staff.selectOption("#j-work", "booking"); await staff.selectOption("#j-size", "Up to 5 pages"); await staff.selectOption("#j-cat", "Food and drink");
await staff.fill("#j-town", "Bristol"); await staff.click("dialog label:has-text('Contact form')"); await staff.selectOption("#j-timing", "As soon as possible");
await staff.click("dialog button:has-text('Continue')");
await staff.fill("input[name=l0d]", "Website build"); await staff.fill("input[name=l0p]", "1500"); await staff.fill("input[name=l1d]", "Hosting"); await staff.fill("input[name=l1p]", "25"); await staff.check("input[name=l1r]");
await staff.click("dialog button:has-text('Create ticket')"); await staff.waitForURL(/\/proposals\/[0-9a-f-]{36}$/);
ok(true, "one popup created the customer and a draft quote ticket");
const earlyProposal = staff.url();
await staff.goto(`${M}/customers`); await staff.click(`a:has-text('${name}')`); await staff.waitForURL(/\/customers\/[0-9a-f-]{36}$/);
const customerUrl = staff.url();
await staff.click("a:has-text('Add details')"); await staff.waitForURL(/details$/);
await staff.fill("#legalName", `${name} Ltd`); await staff.fill("#companyNumber", "07654321"); await staff.fill("#billingAddress", "2 Quay Road, Bristol");
await staff.click("button:has-text('Save details')"); await staff.waitForURL(/details=saved/);
ok(true, "customer details entered by the team");
await staff.goto(earlyProposal);
const proposalUrl = staff.url();
ok(await staff.locator("button:has-text('Send for signature')").isEnabled(), "send is enabled once company, customer and terms are ready");
await staff.fill("#sn", "Casey Morgan");
await staff.click("button:has-text('Send for signature')"); await staff.waitForURL(/sent=1/);
drain();

// 4. Exactly one customer email
const mails = sink().filter((m) => m.to === email);
ok(mails.length === 1 && mails[0].subject.startsWith("Please review and sign"), "customer receives exactly ONE email (the agreement), no separate proposal email");
const link = mails[0].text.match(/https?:\/\/\S+\/s\/\S+/)[0];

// 5. Customer signs on a phone
const phone = await (await browser.newContext({ viewport: { width: 375, height: 800 }, hasTouch: true })).newPage();
await phone.goto(link);
const body = await phone.locator("article").innerText();
for (const n of ["OneSimpleSite Ltd", `${name} Ltd`, "07654321", "A website with bookings in Bristol", "Up to 5 pages", "Contact form", "50% on signing", "£1,500.00", "Terms and Conditions", "2.1"]) ok(body.includes(n), `agreement shows: ${n}`);
ok(!(await phone.evaluate(() => document.documentElement.scrollWidth > innerWidth)), "no horizontal overflow at 375px");
if (process.env.SHOTS) {
  await phone.screenshot({ path: `${process.env.SHOTS}/agree-phone.png`, fullPage: true });
  const dk = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage(); await dk.goto(link);
  await dk.screenshot({ path: `${process.env.SHOTS}/agree-desktop.png`, fullPage: true });
}
ok(await phone.locator("button[role=radio]").first().innerText() === "Draw", "Draw is the first signature option");
ok(await phone.locator("button[role=radio][aria-checked=true]").innerText() === "Draw", "Draw is selected by default");
ok(await phone.locator("button:has-text('Sign and submit')").isDisabled(), "cannot submit until something is drawn");
await phone.locator("canvas").scrollIntoViewIfNeeded();
const box = await phone.locator("canvas").boundingBox();
await phone.mouse.move(box.x + 20, box.y + 80); await phone.mouse.down();
for (let k = 0; k < 20; k++) await phone.mouse.move(box.x + 20 + k * 10, box.y + 40 + (k % 2) * 40);
await phone.mouse.up();
await phone.fill("#name", "Casey Morgan"); await phone.check("input[name=consent]");
await phone.click("button:has-text('Sign and submit')"); await phone.waitForURL(/done$/);
ok(true, "customer signed with one click on a phone-width screen");

// 6. Everything follows automatically
drain();
const all = sink();
const conf = all.find((m) => m.subject.startsWith("Signed:") && m.to === email);
const notice = all.find((m) => m.subject.startsWith("Contract signed") && m.text.includes(email));
ok(conf?.attachments?.length === 1, "customer gets confirmation with the signed PDF");
ok(notice?.to === "hello@onesimplesite.co.uk" && notice.attachments?.length === 1, "hello@ gets the internal notice with the signed PDF");
await staff.goto(proposalUrl);
ok(await staff.locator("text=accepted").count() > 0, "proposal is now accepted (signing = acceptance)");
await staff.click("a:has-text('Open signed copy and status')"); await staff.waitForURL(/\/contracts\//);
const contractPath = new URL(staff.url()).pathname;
ok(await staff.locator("text=Completed").count() > 0, "agreement completed");
const pdf = await get(staff, contractPath + "/pdf");
ok(pdf.status === 200 && pdf.head === "%PDF-", "staff can download the signed PDF");
await staff.goto(`${M}/projects`);
ok(await staff.locator(`text=${title}`).count() === 1, "exactly one project created");

// 7. Portal invitation -> signed document visible only to that customer
await staff.goto(customerUrl); await staff.click("button:has-text('Invite to portal')"); drain();
const inv = sink().find((m) => m.to === email && m.subject.includes("invited you"));
const cl = await (await browser.newContext()).newPage();
await cl.goto(inv.text.match(/https?:\/\/\S+\/invite\/\S+/)[0]);
await cl.fill("#name", "Casey Morgan"); await cl.fill("#password", "a-long-test-password-1"); await cl.click("button:has-text('Create account')"); await cl.waitForURL(/login/);
await cl.fill("#email", email); await cl.fill("#password", "a-long-test-password-1"); await cl.click("button:has-text('Sign in')");
await cl.waitForURL((u) => !u.pathname.startsWith("/login"));
await cl.goto(`${P}/documents`);
ok(await cl.locator(`text=${title}`).count() > 0, "signed agreement appears in the client portal");
const dl = await get(cl, `/documents/${contractPath.split("/").pop()}/pdf`);
ok(dl.status === 200 && dl.head === "%PDF-", "client downloads the signed PDF");
const other = await login(await browser.newContext(), P, "client.b@example.test");
ok((await get(other, `/documents/${contractPath.split("/").pop()}/pdf`)).status === 404, "another client cannot download it");

// 8. Roles: delivery cannot author proposals or open Settings/Team/Backup
const del = await login(await browser.newContext(), M, "demo.delivery@example.test");
await del.goto(`${M}/settings`); ok(del.url().endsWith("/denied"), "delivery denied Settings");
await del.goto(`${M}/backup`); ok(del.url().endsWith("/denied"), "delivery denied Backup");
// Owner: Backup downloads JSON, Team page loads
const bk = await get(staff, "/backup/download"); ok(bk.status === 200 && bk.head.startsWith("{"), "owner can download a backup");
await staff.goto(`${M}/team`); ok(await staff.locator("h1:has-text('Team')").count() === 1, "owner sees Team");
await browser.close();
console.log("ALL OK");
