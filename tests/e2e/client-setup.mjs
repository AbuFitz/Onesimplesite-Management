// A client from signing to a running care plan, seen from both sides: what they can see and pay, what the team can trigger.
import { createRequire } from "node:module";
import { launch, M, P, PW, seedOrder } from "./lib/target.mjs";
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";

const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const { contract: id, title } = await seedOrder("setup");
const b = await launch();
async function login(origin, email, vp) { const ctx = await b.newContext({ viewport: vp }); const p = await ctx.newPage(); await p.goto(`${origin}/login`); await p.fill("#email", email); await p.fill("#password", PW); await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; }
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  if (name === "phone") { /* the phone pass re-checks the customer's side only */ }
  const cl = await login(P, "client.b@example.test", vp); const row = (t) => cl.locator("li").filter({ hasText: title }).filter({ hasText: t }).first();
  await cl.goto(`${P}/billing`); await cl.waitForLoadState("networkidle"); await cl.evaluate(() => document.querySelectorAll("details.more").forEach((d) => (d.open = true)));
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
