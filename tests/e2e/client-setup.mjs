// A client from signing to a running care plan, seen from both sides: what they can see and pay, what the team can trigger.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
writeFileSync("seed-client.tmp.ts", `
import { db } from "@/lib/db";
import { runCompletionWorkflow } from "@/modules/contracts/service";
const u = await db.user.findFirstOrThrow({ where: { email: "client.b@example.test" } });
const m = await db.clientMembership.findFirstOrThrow({ where: { userId: u.id } });
const cu = await db.customer.findUniqueOrThrow({ where: { id: m.customerId } });
const n = Date.now() % 1000000;
const p = await db.proposal.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: "OSS-QT-CS-" + n, title: "Setup test order " + n, currentVersion: 1, status: "accepted" } });
const v = await db.proposalVersion.create({ data: { workspaceId: cu.workspaceId, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 34000, recurringMinor: 2900, recurringPeriod: "month", requirements: { depositPercent: "50", promoFreeMonths: "1", promoFreeEnds: "stop", promoLabel: "New Customer" } } });
const k = await db.contract.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: "OSS-OF-CS-" + n, title: "Setup test order " + n, status: "completed", scopeSnapshot: "x", oneOffMinor: 34000, recurringMinor: 2900, proposalVersionId: v.id, completedAt: new Date() } });
await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
console.log("CONTRACT=" + k.id + " TITLE=" + k.title);
process.exit(0);`);
const out = execSync("npx tsx --env-file=.env seed-client.tmp.ts 2>&1", { encoding: "utf8" }); rmSync("seed-client.tmp.ts");
const id = out.match(/CONTRACT=([0-9a-f-]{36})/)[1], title = out.match(/TITLE=(.+)/)[1].trim();
const b = await chromium.launch();
async function login(origin, email, vp) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); await p.goto(`${origin}/login`); await p.fill("#email", email); await p.fill("#password", "demo-password-123"); await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; }
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  if (name === "phone") { /* the phone pass re-checks the customer's side only */ }
  const cl = await login(P, "client.b@example.test", vp); const row = (t) => cl.locator("li").filter({ hasText: title }).filter({ hasText: t }).first();
  await cl.goto(`${P}/billing`); await cl.waitForLoadState("networkidle");
  ok(await row("Website deposit").locator("button:has-text('Pay now')").count() >= 1, `${name}: the customer can pay the deposit`);
  if (name === "phone") ok(await row("Website final payment").locator("button:has-text('Pay now')").count() >= 1, "phone: and the final payment, once asked for");
  const plan = row("Care plan (free for 1 month");
  ok(name === "phone" ? /Free until .*, then ends/.test(await plan.innerText()) : /Free for 1 month from launch, then ends/.test(await plan.innerText()), `${name}: the free care plan says ${name === "phone" ? "when it ends" : "it starts at launch"}`);
  ok(await plan.locator("button").count() === 0, `${name}: there is nothing to press on a plan that has not started`);
  ok(!/first payment/i.test(await plan.innerText()), `${name}: it never promises a payment`);
  ok(!(await cl.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name}: billing fits the screen`);
  if (name === "phone") break;
  // the team's side
  const st = await login(M, "demo.owner@example.test", vp);
  await st.goto(`${M}/contracts/${id}`); await st.waitForLoadState("networkidle");
  const panel = st.locator("li", { hasText: "Website deposit" }).first();
  ok(/Due/.test(await panel.innerText()), "team: the deposit shows as due");
  ok(/Due before launch/.test(await st.locator("li", { hasText: "Website final payment" }).first().innerText()), "team: the final payment shows as due before launch, not due");
  await panel.locator("button:has-text('Email them the payment link')").click(); await st.waitForSelector("text=Payment link emailed to");
  ok(true, "team: emailing the payment link confirms who it went to");
  await st.goto(`${M}/contracts/${id}`);
  await st.locator("button:has-text('Start the free month now')").click(); await st.waitForLoadState("networkidle");
  ok(/Free until .*, then ends/.test(await st.locator("main").innerText()), "team: starting the free month shows when it ends");
  await st.locator("li", { hasText: "Website final payment" }).locator("button:has-text('Ask for the final payment now')").click(); await st.waitForFunction(() => !document.body.innerText.includes("Ask for the final payment now"));
  await cl.goto(`${P}/billing`); await cl.waitForLoadState("networkidle");
  ok(/Free until .*, then ends/.test(await row("Care plan (free for 1 month").innerText()), "customer: sees the free month running, with its end date");
  ok(await row("Website final payment").locator("button:has-text('Pay now')").count() >= 1, "customer: can now pay the final payment");
}
await b.close(); console.log("ALL OK");
