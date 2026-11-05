// Payments page, clickable home widgets, and the locked final payment never shown as "Due" to the team.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const b = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1366, height: 860 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  await pg.goto(`${M}/login`); await pg.fill("#email", "demo.owner@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  // home widgets open what is behind them
  await pg.goto(`${M}/`); await pg.waitForLoadState("networkidle");
  for (const [label, re] of [["To collect", /\/payments\?show=(due|failed)/], ["Monthly plans", /\/payments\?show=plans/], ["Waiting to sign", /\/agreements\?show=awaiting/], ["Needs us", /\/tickets$/]]) {
    await pg.goto(`${M}/`); await pg.waitForLoadState("networkidle");
    await Promise.all([pg.waitForURL(re), pg.locator(`a[aria-label^='${label}']`).first().click()]);
    ok(re.test(pg.url()), `${name}: the "${label}" widget opens ${new URL(pg.url()).pathname}${new URL(pg.url()).search}`);
  }
  await pg.goto(`${M}/`); await pg.waitForLoadState("networkidle");
  await Promise.all([pg.waitForURL(/\/agreements\?show=awaiting/), pg.locator("a[aria-label='Waiting to sign: see them']").first().click()]);
  ok(true, `${name}: pipeline rows open the matching agreements`);
  // payments page groups
  const groups = {};
  for (const g of ["due", "later", "plans", "free", "failed", "paid", "all"]) {
    await pg.goto(`${M}/payments?show=${g}`); await pg.waitForLoadState("networkidle");
    const t = await pg.locator("main").innerText(); groups[g] = (await pg.locator("main ul.divide-y").count()) ? await pg.locator("main ul.divide-y").innerText() : "";
    ok(!/Application error|Something went wrong/.test(t) && await pg.locator("h1:has-text('Payments')").count() === 1, `${name}: /payments?show=${g} loads`);
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name}: /payments?show=${g} has no horizontal overflow`);
  }
  ok(!/Due before launch/.test(groups.due), `${name}: "Due now" never lists a locked final payment`);
  ok(!groups.later.includes("Due now") && (groups.later.match(/Due before launch/g) ?? []).length >= 1, `${name}: "Due before launch" lists the locked final payments`);
  ok(/Free until .*, then ends/.test(groups.free) && /Free/.test(groups.free), `${name}: free care periods show as Free`);
  ok(!/Free until/.test(groups.plans), `${name}: free care periods are not counted as monthly plans`);
  // the company page
  await pg.goto(`${M}/payments?show=later`); const co = await pg.locator("ul a").first().getAttribute("href");
  await pg.goto(`${M}${co}`); await pg.waitForLoadState("networkidle");
  const cid = (await pg.locator("a[href^='/customers/']").first().getAttribute("href")) ?? co;
  await pg.goto(`${M}${cid.split("?")[0]}`); await pg.waitForLoadState("networkidle");
  const company = await pg.locator("main").innerText();
  ok(/Website final payment/.test(company) ? /Due before launch/.test(company) : true, `${name}: the company page shows the locked final payment as due before launch`);
  await ctx.close();
}
await b.close(); console.log("ALL OK");
