// The customer's view of the new payment states: deposit, locked final payment, free care plan that ends.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const b = await chromium.launch();
for (const [name, vp] of [["desktop", { width: 1280, height: 900 }], ["phone", { width: 390, height: 844 }]]) {
  const ctx = await b.newContext({ viewport: vp }); const pg = await ctx.newPage();
  await pg.goto(`${P}/login`); await pg.fill("#email", "client.b@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  const errors = []; pg.on("pageerror", (e) => errors.push(e.message));
  await pg.goto(`${P}/billing`); await pg.waitForLoadState("networkidle");
  const t = await pg.locator("main").innerText();
  ok(/Website deposit/.test(t) && /Website final payment/.test(t), `${name}: deposit and final payment both listed`);
  ok(/Due before launch/.test(t), `${name}: the final payment shows as due before launch`);
  const rows = pg.locator("li", { hasText: "Website final payment" });
  ok(await rows.first().locator("button:has-text('Pay now')").count() === 0, `${name}: no Pay now on the locked final payment`);
  ok(await pg.locator("li", { hasText: "Website deposit" }).first().locator("button:has-text('Pay now')").count() === 1, `${name}: the deposit can be paid`);
  ok(/Free until .*, then ends/.test(t) && /no card needed/.test(t), `${name}: the free care plan says free, then ends, no card`);
  ok(!/£29\.00\s*\/\s*month/.test(t), `${name}: £29 a month is not shown as a charge`);
  ok(!/first payment/i.test(t), `${name}: it never promises a first payment`);
  ok(await pg.locator("button:has-text('Manage card')").count() === 0, `${name}: no card manager for a plan with no card`);
  ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name}: billing has no horizontal overflow`);
  for (const path of ["/overview", "/documents", "/projects", "/people", "/account", "/help"]) {
    const r = await pg.goto(`${P}${path}`); await pg.waitForLoadState("networkidle");
    ok(r.status() < 400 && !/Application error|Something went wrong/.test(await pg.locator("body").innerText()), `${name}: ${path} loads`);
  }
  ok(errors.length === 0, `${name}: no script errors (${errors[0] ?? "none"})`);
  await ctx.close();
}
await b.close(); console.log("ALL OK");
