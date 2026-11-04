// Crawls every reachable page in both portals as a signed-in user and reports errors, dead ends and mobile overflow.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const browser = await chromium.launch();
async function crawl(origin, email, vp, label) {
  const ctx = await browser.newContext({ viewport: vp, hasTouch: vp.width < 600, isMobile: vp.width < 600 }); const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(`pageerror ${page.url()} ${e.message.slice(0, 120)}`));
  page.on("response", (r) => { if (r.status() >= 500) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(`${origin}/login`); await page.fill("#email", email); await page.fill("#password", "demo-password-123"); await page.click("button:has-text('Sign in')");
  await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  const seen = new Set(), queue = ["/"], out = [];
  while (queue.length && seen.size < 140) {
    const path = queue.shift(); if (seen.has(path)) continue; seen.add(path);
    const resp = await page.goto(origin + path, { waitUntil: "domcontentloaded" }).catch((e) => ({ status: () => 0, err: e }));
    await page.waitForLoadState("networkidle").catch(() => {});
    const st = resp.status();
    const info = await page.evaluate(() => ({ text: document.body.innerText.slice(0, 4000), over: document.documentElement.scrollWidth > innerWidth + 1, h1: document.querySelector("h1")?.innerText ?? "", links: [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href")), small: [...document.querySelectorAll("a,button")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && r.height < 28 && getComputedStyle(e).visibility !== "hidden" && !e.closest("[aria-hidden=true]"); }).length }));
    const bad = st >= 400 && ![401, 403].includes(st) || /Application error|Something went wrong|This page couldn.t load|Unhandled|Internal Server/i.test(info.text) || /\b[Bb]usiness(es)?\b/.test(info.text.replace(/Business settings|Business data/g, ""));
    if (bad || info.over) out.push(`${bad ? "BAD" : "OVERFLOW"} ${st} ${path} :: ${info.h1.slice(0, 50)}`);
    for (const h of info.links) { if (!h || h.startsWith("#") || h.startsWith("mailto:") || h.startsWith("tel:") || /^https?:/.test(h) || /^\/(api|files|logout|sign-out)|\/ics$|\/pdf$|\/receipt|download|\/avatar|\/logo/.test(h) || /[?&](delete|reset)=/.test(h)) continue; queue.push(h.split("#")[0]); }
  }
  console.log(`\n== ${label}: ${seen.size} pages, ${out.length} issues`); out.forEach((o) => console.log("  " + o)); [...new Set(errors)].slice(0, 15).forEach((e) => console.log("  ERR " + e));
  await ctx.close();
}
await crawl(M, "demo.owner@example.test", { width: 1280, height: 900 }, "team desktop");
await crawl(M, "demo.owner@example.test", { width: 390, height: 844 }, "team phone");
await crawl(P, "client.b@example.test", { width: 1280, height: 900 }, "portal desktop");
await crawl(P, "client.b@example.test", { width: 390, height: 844 }, "portal phone");
await browser.close();
