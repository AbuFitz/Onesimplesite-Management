// Signing in brings people back to the page they asked for, on both the portal and the team app, and never to another site.
import { createRequire } from "node:module";
import { launch, M, P, PW } from "./lib/target.mjs";

const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const browser = await launch();
async function go(origin, path, email) {
  const pg = await (await browser.newContext()).newPage();
  await pg.goto(origin + path); await pg.waitForURL(/\/login/);
  const next = new URL(pg.url()).searchParams.get("next");
  await pg.fill("#email", email); await pg.fill("#password", PW); await pg.click("button:has-text('Sign in')");
  await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  return { next, landed: new URL(pg.url()).pathname };
}
let r = await go(P, "/help", "client.b@example.test"); ok(r.next === "/help" && r.landed === "/help", "portal: /help asks you to sign in, then lands on /help");
r = await go(M, "/tickets", "demo.owner@example.test"); ok(r.next === "/tickets" && r.landed === "/tickets", "team app: /tickets asks you to sign in, then lands on /tickets");
const pg = await (await browser.newContext()).newPage(); await pg.goto(`${P}/login?next=${encodeURIComponent("https://evil.example/x")}`);
await pg.fill("#email", "client.b@example.test"); await pg.fill("#password", PW); await pg.click("button:has-text('Sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
ok(new URL(pg.url()).host === new URL(P).host, "a link to another site is ignored");
console.log("ALL OK"); await browser.close();
