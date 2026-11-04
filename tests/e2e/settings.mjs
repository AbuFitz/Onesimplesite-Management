// Settings: grouped menu on desktop, scrolling pills on a phone, passkey QR, no overflow.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const shots = process.argv[2];
const b = await chromium.launch();
async function run(name, viewport) {
  const ctx = await b.newContext({ viewport, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.goto(`${M}/login`); await pg.fill("#email", "demo.owner@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  for (const [path, title] of [["/settings", "Company details"], ["/settings/plans", "Plans and details"], ["/settings/legal", "Legal documents"], ["/settings/emails", "Emails"], ["/settings/notifications", "Notifications"], ["/settings/security", "Sign-in security"]]) {
    await pg.goto(`${M}${path}`); await pg.waitForLoadState("networkidle");
    ok((await pg.locator("h1").first().innerText()).trim() === title, `${name}: ${path} is titled ${title}`);
    ok(await pg.locator("[aria-current=page]:visible").count() >= 1, `${name}: ${path} highlights its section`);
    ok(!(await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth)), `${name}: ${path} has no horizontal overflow`);
    if (shots) await pg.screenshot({ path: `${shots}/${name}${path.replaceAll("/", "-")}.png` });
  }
  await pg.goto(`${M}/account`); await pg.waitForLoadState("networkidle"); await pg.waitForTimeout(800);
  if (shots) await pg.screenshot({ path: `${shots}/${name}-account.png`, fullPage: true });
  const qr = await pg.locator("img[alt*='QR code that opens this page']").isVisible();
  ok(name === "desktop" ? qr : !qr, `${name}: passkey QR is ${name === "desktop" ? "shown on a computer" : "hidden on a phone"}`);
  await ctx.close();
}
await run("desktop", { width: 1366, height: 860 });
await run("phone", { width: 375, height: 800 });
await b.close(); console.log("ALL OK");
