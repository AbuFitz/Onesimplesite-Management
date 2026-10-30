// Screenshots of every experience. Needs a running server (APP_ENV=development) and scripts/showcase-data.ts run first.
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const OUT = process.env.OUT ?? "docs/showcase/v2/";
const S = JSON.parse(readFileSync(process.env.SHOWCASE_JSON ?? "/tmp/showcase.json", "utf8"));
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const b = await chromium.launch();
const sizes = { d: { width: 1280, height: 860 }, m: { width: 390, height: 844 } };
async function session(origin, email, vp) {
  const c = await b.newContext({ viewport: vp, hasTouch: vp.width < 500, deviceScaleFactor: 2 }); const p = await c.newPage();
  await p.goto(`${origin}/login`); await p.fill("#email", email); await p.fill("#password", "demo-password-123");
  await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p;
}
const snap = async (p, url, name, full = true) => { await p.goto(url); await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(250); await p.screenshot({ path: `${OUT}${name}.png`, fullPage: full }); };

for (const [k, vp] of Object.entries(sizes)) {
  const t = k === "d" ? "desktop" : "phone";
  const s = await session(M, "demo.owner@example.test", vp);
  await snap(s, `${M}/`, `staff-today-${t}`);
  await snap(s, `${M}/customers`, `staff-customers-${t}`);
  await s.goto(`${M}/customers`); await s.click("main ul a >> nth=0"); await s.waitForURL(/customers\/[0-9a-f-]{36}$/); const cu = s.url();
  await snap(s, cu, `staff-customer-overview-${t}`); await snap(s, `${cu}?tab=agreements`, `staff-customer-agreements-${t}`);
  await s.goto(`${M}/proposals`); await s.click("main ul a >> nth=0"); await s.waitForURL(/proposals\/[0-9a-f-]{36}$/);
  await snap(s, s.url(), `staff-proposal-${t}`);
  await snap(s, `${M}/contracts`, `staff-agreements-${t}`);
  await snap(s, `${M}/settings`, `staff-settings-company-${t}`);
  await s.goto(`${M}/settings/terms`); await s.click("main ul a >> nth=0"); await s.waitForURL(/terms\/[0-9a-f-]{36}$/); await snap(s, s.url(), `staff-settings-terms-${t}`);
  await snap(s, `${M}/team`, `staff-team-${t}`); await snap(s, `${M}/backup`, `staff-backup-${t}`);
  await snap(s, `${M}/search?q=bakery`, `staff-search-${t}`); await snap(s, `${M}/projects`, `staff-projects-${t}`);
  if (k === "m") await snap(s, `${M}/more`, `staff-more-${t}`);
  // customer-facing
  const pub = await (await b.newContext({ viewport: vp, deviceScaleFactor: 2, hasTouch: k === "m" })).newPage();
  await snap(pub, S.sign, `customer-agreement-${t}`);
  await snap(pub, `${P}/s/x/done`, `customer-signed-${t}`, false);
  await snap(pub, `${P}/s/invalid-token`, `customer-link-unavailable-${t}`, false);
  await snap(pub, `${P}/login`, `portal-login-${t}`, false); await snap(pub, `${P}/forgot-password`, `auth-forgot-${t}`, false); await snap(pub, `${P}/reset-password`, `auth-reset-expired-${t}`, false);
  const c = await session(P, "client.a@example.test", vp);
  await snap(c, `${P}/overview`, `portal-overview-${t}`); await snap(c, `${P}/projects`, `portal-projects-${t}`);
  await c.goto(`${P}/projects`); await c.click("main ul a >> nth=0"); await c.waitForURL(/projects\/[0-9a-f-]{36}/); await snap(c, c.url(), `portal-project-${t}`);
  await snap(c, `${P}/documents`, `portal-documents-${t}`); await snap(c, `${P}/account`, `portal-account-${t}`);
}
for (const n of ["proposal", "contract_request", "signing_confirmation", "signing_notice", "invitation", "password_reset", "password_changed", "staff_invitation", "backup_reminder"]) {
  for (const [k, w] of [["m", 390], ["d", 760]]) { const p = await (await b.newContext({ viewport: { width: w, height: 700 }, deviceScaleFactor: 2 })).newPage(); await snap(p, `${M}/dev/emails/${n}`, `email-${n}-${k === "m" ? "phone" : "desktop"}`); }
}
await b.close(); console.log("done");
