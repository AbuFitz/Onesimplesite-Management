// Regenerates docs/showcase PNGs from a running dev server. Usage: see scripts/README.md
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
const { chromium } = createRequire(import.meta.url)("playwright");
const S = JSON.parse(readFileSync(process.env.SHOWCASE_JSON ?? "/tmp/showcase.json", "utf8"));
const out = "docs/showcase/";
const M = "http://manage.localhost:3000";
const b = await chromium.launch();
const shot = async (url, name, w, h, full = true, pre) => { const c = await b.newContext({ viewport: { width: w, height: h } }); const p = await c.newPage(); if (pre) await pre(p); await p.goto(url); await p.waitForTimeout(300); await p.screenshot({ path: `${out}${name}.png`, fullPage: full }); await c.close(); };
for (const [w, tag] of [[390, "mobile"], [1280, "desktop"]]) {
  await shot(S.proposalOpen, `page-proposal-${tag}`, w, 900);
  await shot(S.sign, `page-sign-${tag}`, w, 900);
  await shot(S.proposalOpen.replace("/p/", "/p/invalid"), `page-link-unavailable-${tag}`, w, 600, false);
  await shot(S.sign.replace(/\/s\/.*/, "/s/x/done"), `page-signed-done-${tag}`, w, 600, false);
}
for (const n of ["proposal", "contract_request", "signing_confirmation", "signing_notice", "invitation"]) {
  await shot(`${M}/dev/emails/${n}`, `email-${n}-mobile`, 390, 700);
  await shot(`${M}/dev/emails/${n}`, `email-${n}-desktop`, 800, 700);
}
// staff screens
const c = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await c.newPage();
await p.goto(M + "/login"); await p.fill("#email", "demo.owner@example.test"); await p.fill("#password", "demo-password-123"); await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login"));
await p.goto(M + "/contracts"); await p.click("a:has-text('Website build and care plan') >> nth=0"); await p.waitForTimeout(300); await p.screenshot({ path: out + "staff-contract-desktop.png", fullPage: true });
await p.goto(M + "/proposals"); await p.click("ul a >> nth=0"); await p.waitForTimeout(300); await p.screenshot({ path: out + "staff-proposal-desktop.png", fullPage: true });
await p.goto(M + "/"); await p.screenshot({ path: out + "staff-today-desktop.png", fullPage: true });
await b.close();
