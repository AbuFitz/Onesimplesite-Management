// Customer sends material into a project without a ticket; pictures and logos show on the other side.
// Usage: node tests/e2e/uploads.mjs <projectId> <customerId>   (the project must have open "what we need" requests)
import { createRequire } from "node:module";
import { launch, M, P, PW, ids, freshRequests } from "./lib/target.mjs";
import { writeFileSync } from "node:fs";
const found = process.argv[2] ? {} : await ids();
await freshRequests();   // earlier runs answer the requests, so add open ones
const PROJECT = process.argv[2] ?? found.project, CUSTOMER = process.argv[3] ?? found.customer;
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64"); writeFileSync("/tmp/pixel.png", png);
const browser = await launch();
async function login(origin, email, vp = { width: 1280, height: 900 }) { const ctx = await browser.newContext({ viewport: vp }); const p = await ctx.newPage(); await p.goto(`${origin}/login`); await p.fill("#email", email); await p.fill("#password", PW); await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; }
const cl = await login(P, "client.b@example.test", { width: 390, height: 844 });
await cl.goto(`${P}/projects/${PROJECT}`);
ok(await cl.locator("text=What we need from you").count() > 0, "customer sees what we need from them");
ok(await cl.locator("main >> text=raise a ticket").count() === 0, "no 'raise a ticket' detour any more");
await cl.fill("details[open] textarea[name=text]", "Mon-Fri 9 to 5. We are a family bakery since 1998.");
await cl.setInputFiles("details[open] input[type=file]", "/tmp/pixel.png");
const sentBefore = await cl.locator("text=Sent ✓").count();   // earlier runs leave answered requests, so count the change
await cl.click("details[open] button:has-text('Send to us')"); await cl.waitForURL(/sent=1/);
await cl.waitForSelector("text=We've got it"); ok(true, "customer sees a confirmation");
ok(await cl.locator("text=Sent ✓").count() === sentBefore + 1, "that request is marked sent");
await cl.setInputFiles("section[aria-labelledby=x] input[type=file]", "/tmp/pixel.png"); await cl.fill("#x-t", "Extra photo of the shop front");
await cl.click("section[aria-labelledby=x] button:has-text('Send to us')"); await cl.waitForURL(/sent=1/);
await cl.setInputFiles("section[aria-labelledby=x] input[type=file]", "/tmp/pixel.png");
await cl.click("section[aria-labelledby=x] button[aria-haspopup=dialog]"); await cl.waitForSelector("dialog[open] img", { state: "attached" });
ok(cl.context().pages().length === 1, "clicking a picture before sending opens it in a frame, not a new tab");
await cl.keyboard.press("Escape"); await cl.waitForSelector("dialog[open]", { state: "detached" });
await cl.click("section[aria-labelledby=f] button:has-text('View') >> nth=0"); await cl.waitForSelector("dialog[open] img", { state: "attached" }); ok(cl.context().pages().length === 1, "files in the project open in a frame"); await cl.keyboard.press("Escape");
await cl.goto(`${P}/account`); await cl.setInputFiles("input[name=photo]", "/tmp/pixel.png"); await cl.waitForSelector("button:has-text('Save picture')"); await cl.click("button:has-text('Save picture')"); await cl.waitForURL(/photo=1/);
ok(await cl.locator("text=Picture saved").count() > 0, "customer saves a profile picture");
const mine = await cl.evaluate(async () => { const e = document.querySelector("[style*='/avatar/u/']"); return e ? (await fetch(e.getAttribute("style").match(/url\(([^)]+)\)/)[1].replace(/["']/g, ""))).status : 0; });
ok(mine === 200, "their picture is served to them");
const st = await login(M, "demo.owner@example.test");
await st.goto(`${M}/projects/${PROJECT}`);
const txt = await st.locator("main").innerText();
ok(txt.includes("family bakery since 1998"), "team sees what the customer wrote next to the request");
ok(/received/i.test(txt), "request shows as received");
ok(txt.includes("From you"), "team sees the uploaded files in a 'From you' folder");
ok(txt.includes("sent: Logo"), "a to-do for the project owner is added to the project");
await st.goto(`${M}/customers/${CUSTOMER}/details`); await st.setInputFiles("input[name=photo]", "/tmp/pixel.png"); await st.waitForSelector("button:has-text('Save logo')"); await st.click("button:has-text('Save logo')"); await st.waitForURL(/logo=1/);
ok(await st.evaluate(async (id) => (await fetch("/api/logo/" + id)).status, CUSTOMER) === 200, "team uploads a company logo and it is served");
await st.goto(`${M}/customers/${CUSTOMER}?tab=people`);
const ap = await st.evaluate(async () => { const e = document.querySelector("[style*='/api/avatar/u/']"); return e ? (await fetch(e.getAttribute("style").match(/url\(([^)]+)\)/)[1].replace(/["']/g, ""))).status : 0; });
ok(ap === 200, "customer's picture shows against their name in the team's People tab");
console.log("ALL OK"); await browser.close();
