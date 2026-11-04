// Passkeys (with a virtual authenticator) and the emailed one-time code on a new device, including "trust this device".
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const mode = (codes, testers = "") => execSync(`npx tsx --env-file=.env -e "import('./src/lib/db.ts').then(async ({db})=>{const u=await db.user.findUnique({where:{email:'demo.owner@example.test'},include:{staffMemberships:true}});const ws=u.staffMemberships[0].workspaceId;const w=await db.workspace.findUnique({where:{id:ws}});await db.workspace.update({where:{id:ws},data:{settings:{...(w.settings||{}),security:{codes:'${codes}',testers:'${testers}'.split(',').filter(Boolean)}}}});await db.user.updateMany({where:{email:{in:['demo.owner@example.test','client.b@example.test']}},data:{twoFactorEnabled:false}});process.exit(0)})"`, { stdio: "ignore" });
const sink = () => readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8")));
const lastCode = (to) => { const m = sink().filter((x) => x.to === to && /sign-in code/i.test(x.subject)); return m.length ? m[m.length - 1].subject.match(/^(\d{6})/)?.[1] : null; };
const browser = await chromium.launch();
async function signIn(page, origin, email) { await page.goto(`${origin}/login`); await page.fill("#email", email); await page.fill("#password", "demo-password-123"); await page.click("button:has-text('Sign in')"); }

try {
  // 1. Off by default: straight in, nothing changes.
  mode("off");
  let ctx = await browser.newContext(); let pg = await ctx.newPage();
  await signIn(pg, P, "client.b@example.test"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  ok(true, "with codes off, sign-in is unchanged");
  await ctx.close();

  // 2. Passkey: add on the team app, then sign in with it.
  ctx = await browser.newContext(); pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg); await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await signIn(pg, M, "demo.owner@example.test"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"));
  await pg.goto(`${M}/account`); await pg.waitForSelector("text=Add a passkey");
  await pg.fill("#pk-n", "E2E laptop"); await pg.click("button:has-text('Add a passkey')"); await pg.waitForSelector("text=Passkey added");
  ok(await pg.locator("text=E2E laptop").count() > 0, "team member adds a passkey and sees it listed");
  await ctx.clearCookies(); await pg.goto(`${M}/login`);
  await pg.click("button:has-text('Sign in with a passkey')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  ok(true, "signing in with the passkey works, no password typed");
  await pg.goto(`${M}/account`); pg.once("dialog", (d) => d.accept()); await pg.click("button[aria-label^='Remove E2E laptop']"); await pg.waitForSelector("text=No passkeys yet");
  ok(true, "passkey can be removed");
  await ctx.close();

  // 3. Emailed code on a new device (testers mode), trust this device, and a different device asks again.
  mode("testers", "client.b@example.test"); rmSync(".mail-sink", { recursive: true, force: true });
  ctx = await browser.newContext(); pg = await ctx.newPage();
  await signIn(pg, P, "client.b@example.test"); await pg.waitForSelector("#code");
  ok(true, "a new device is asked for a code after the password");
  await pg.waitForTimeout(2500); const code = lastCode("client.b@example.test"); ok(!!code, "the 6-digit code was emailed");
  await pg.fill("#code", "000000"); await pg.click("button:has-text('Verify and sign in')"); await pg.waitForSelector("text=That code didn't work");
  ok(true, "a wrong code is refused with a plain message");
  await pg.fill("#code", code); await pg.click("button:has-text('Verify and sign in')"); await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  ok(true, "the right code signs them in");
  await pg.context().clearCookies({ name: /session_token/ }); await pg.goto(`${P}/login`);
  await pg.fill("#email", "client.b@example.test"); await pg.fill("#password", "demo-password-123"); await pg.click("button:has-text('Sign in')");
  await pg.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 15000 });
  ok(true, "the same device is trusted: no code the second time, even after the session ended");
  const other = await (await browser.newContext()).newPage(); await signIn(other, P, "client.b@example.test"); await other.waitForSelector("#code");
  ok(true, "a different device is asked again");
  // someone not in the tester list is not asked
  const staffPg = await (await browser.newContext()).newPage(); await signIn(staffPg, M, "demo.owner@example.test"); await staffPg.waitForURL((u) => !u.pathname.startsWith("/login"));
  ok(true, "people outside the test list are not asked while testing");
  console.log("ALL OK");
} finally { mode("off"); await browser.close(); }
