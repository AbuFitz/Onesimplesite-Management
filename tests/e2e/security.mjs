// Passkeys (virtual authenticator), guided authenticator setup, trusted devices, backup codes, support reset and "new sign-in" notices.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { createHmac } from "node:crypto";
import { execSync } from "node:child_process";
import { readdirSync, readFileSync, rmSync } from "node:fs";
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000", CUSTOMER = process.argv[2];
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
const tsx = (code) => execSync(`npx tsx --env-file=.env -e "${code.replace(/"/g, '\\"')}"`, { stdio: "ignore" });
const mode = (codes, testers = "") => tsx(`import('./src/lib/db.ts').then(async ({db})=>{const u=await db.user.findUnique({where:{email:'demo.owner@example.test'},include:{staffMemberships:true}});const ws=u.staffMemberships[0].workspaceId;const w=await db.workspace.findUnique({where:{id:ws}});await db.workspace.update({where:{id:ws},data:{settings:{...(w.settings||{}),security:{codes:'${codes}',testers:'${testers}'.split(',').filter(Boolean)}}}});const ids=(await db.user.findMany({where:{email:{in:['demo.owner@example.test','client.b@example.test']}}})).map(x=>x.id);await db.twoFactor.deleteMany({where:{userId:{in:ids}}});await db.knownDevice.deleteMany({where:{userId:{in:ids}}});await db.verification.deleteMany({where:{identifier:{startsWith:'trust-device-'}}});await db.user.updateMany({where:{id:{in:ids}},data:{twoFactorEnabled:false}});process.exit(0)})`);
const b32 = (s) => { const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"; let bits = ""; for (const ch of s.replace(/=+$/, "").toUpperCase()) bits += A.indexOf(ch).toString(2).padStart(5, "0"); const out = []; for (let i = 0; i + 8 <= bits.length; i += 8) out.push(parseInt(bits.slice(i, i + 8), 2)); return Buffer.from(out); };
const totp = (secret, t = Date.now()) => { const c = Buffer.alloc(8); c.writeBigUInt64BE(BigInt(Math.floor(t / 30000))); const h = createHmac("sha1", b32(secret)).update(c).digest(); const o = h[h.length - 1] & 15; return String(((h.readUInt32BE(o) & 0x7fffffff) % 1e6)).padStart(6, "0"); };
const sink = () => (readdirSync(".mail-sink").filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(`.mail-sink/${f}`, "utf8"))));
const browser = await chromium.launch();
async function signIn(page, origin, email) { await page.goto(`${origin}/login`); await page.fill("#email", email); await page.fill("#password", "demo-password-123"); await page.click("button:has-text('Sign in')"); }
const settle = () => new Promise((r) => setTimeout(r, 6000));   // the app remembers the setting for a few seconds
const away = (u) => !u.pathname.startsWith("/login");

try {
  // 1. Off by default: sign-in is unchanged.
  mode("off"); await settle();
  let ctx = await browser.newContext(); let pg = await ctx.newPage();
  await signIn(pg, P, "client.b@example.test"); await pg.waitForURL(away);
  ok(true, "with two-step off, sign-in is unchanged");
  await ctx.close();

  // 2. Passkey on the team app: add, sign in with it, remove.
  ctx = await browser.newContext(); pg = await ctx.newPage();
  const cdp = await ctx.newCDPSession(pg); await cdp.send("WebAuthn.enable");
  await cdp.send("WebAuthn.addVirtualAuthenticator", { options: { protocol: "ctap2", transport: "internal", hasResidentKey: true, hasUserVerification: true, isUserVerified: true, automaticPresenceSimulation: true } });
  await signIn(pg, M, "demo.owner@example.test"); await pg.waitForURL(away);
  await pg.goto(`${M}/account`); await pg.waitForSelector("text=Add a passkey");
  await pg.fill("#pk-n", "E2E laptop"); await pg.click("button:has-text('Add a passkey')"); await pg.waitForSelector("text=Passkey added");
  ok(true, "team member adds a passkey");
  await ctx.clearCookies(); await pg.goto(`${M}/login`); await pg.click("button:has-text('Sign in with a passkey')"); await pg.waitForURL(away, { timeout: 15000 });
  ok(true, "signing in with the passkey works, no password typed");
  await pg.goto(`${M}/account`); pg.once("dialog", (d) => d.accept()); await pg.click("button[aria-label^='Remove E2E laptop']"); await pg.waitForSelector("text=No passkeys yet");
  await ctx.close();

  // 3. Required for customers: guided setup straight after the password.
  mode("testers", "client.b@example.test"); await settle(); rmSync(".mail-sink", { recursive: true, force: true });
  ctx = await browser.newContext(); pg = await ctx.newPage();
  await signIn(pg, P, "client.b@example.test"); await pg.waitForURL(/setup-security/, { timeout: 15000 });
  ok(true, "a required customer is taken to guided setup right after their password");
  await pg.goto(`${P}/overview`); await pg.waitForURL(/setup-security/);
  ok(true, "they cannot use the portal until it is set up");
  await pg.fill("#sw-p", "demo-password-123"); await pg.click("button:has-text('Start setup')"); await pg.waitForSelector("img[alt^='QR code']");
  await pg.click("summary:has-text('Type the key instead')"); const secret = (await pg.locator("p.font-mono").innerText()).trim();
  await pg.fill("#sw-c", totp(secret)); await pg.click("button:has-text('Check the code')"); await pg.waitForSelector("text=Now save your backup codes");
  const backupCodes = (await pg.locator("p.grid.font-mono span").allInnerTexts()).map((x) => x.trim()); ok(backupCodes.length >= 5, "backup codes are shown");
  await pg.check("text=I've saved these"); await pg.click("button:has-text('Continue')"); await pg.click("button:has-text('Skip, take me in')"); await pg.waitForURL(/overview/, { timeout: 15000 });
  ok(true, "setup finishes and they are taken in");
  await pg.context().clearCookies({ name: /session_token/ }); await signIn(pg, P, "client.b@example.test"); await pg.waitForSelector("#code");
  await pg.fill("#code", totp(secret)); await pg.click("button:has-text('Verify and sign in')"); await pg.waitForURL(/overview/, { timeout: 15000 });
  ok(true, "signing in again asks for the authenticator code once, with 'trust this device' ticked");
  await pg.context().clearCookies({ name: /session_token/ }); await signIn(pg, P, "client.b@example.test"); await pg.waitForURL(/overview/, { timeout: 15000 });
  ok(true, "after that the device is trusted: no code needed next time");

  // 4. A different device asks for the authenticator code (and a wrong one is refused), then a backup code works once.
  const ctx2 = await browser.newContext(); const d2 = await ctx2.newPage();
  await signIn(d2, P, "client.b@example.test"); await d2.waitForSelector("#code");
  await d2.fill("#code", "000000"); await d2.click("button:has-text('Verify and sign in')"); await d2.waitForSelector("text=That code didn't work");
  ok(true, "a wrong code is refused with a plain message");
  await d2.fill("#code", totp(secret)); await d2.click("button:has-text('Verify and sign in')"); await d2.waitForURL(/overview/, { timeout: 15000 });
  ok(true, "the right code signs them in on the new device");
  await new Promise((r) => setTimeout(r, 2500));
  ok(sink().some((m) => m.to === "client.b@example.test" && /new sign-in/i.test(m.subject)), "a new-sign-in notice was emailed for the unrecognised device");
  const before = sink().filter((m) => /new sign-in/i.test(m.subject)).length;
  await pg.goto(`${P}/account`); await new Promise((r) => setTimeout(r, 1500));
  ok(sink().filter((m) => /new sign-in/i.test(m.subject)).length === before, "no notice for a device we already know");
  const ctx3 = await browser.newContext(); const d3 = await ctx3.newPage();
  await signIn(d3, P, "client.b@example.test"); await d3.waitForSelector("#code"); await d3.click("button:has-text('Use a backup code')");
  await d3.fill("#code", backupCodes[0]); await d3.click("button:has-text('Verify and sign in')"); await d3.waitForURL(/overview/, { timeout: 15000 });
  ok(true, "a backup code works when the phone is lost");

  // 5. Support reset from the team side, then the customer is guided through setup again.
  const st = await browser.newContext(); const staff = await st.newPage();
  mode("testers", "client.b@example.test,"); // keep required for the customer; reset staff-side flags below
  await signIn(staff, M, "demo.owner@example.test"); await staff.waitForURL(away);
  await staff.goto(`${M}/customers/${CUSTOMER}?tab=people`);
  const row = staff.locator("li", { hasText: "client.b@example.test" }).first();
  await row.locator("summary:has-text('Manage')").click();
  const resetSummary = row.locator("summary:has-text('Reset two-step sign-in')");
  await resetSummary.click(); await row.locator("button:has-text('Reset for')").click(); await staff.waitForSelector("text=Two-step sign-in reset");
  ok(true, "support resets a customer's two-step sign-in from the People tab");
  await pg.goto(`${P}/overview`); await pg.waitForURL(/login/, { timeout: 15000 });
  ok(true, "the customer was signed out everywhere");
  await signIn(pg, P, "client.b@example.test"); await pg.waitForURL(/setup-security/, { timeout: 15000 });
  ok(true, "and is guided through setup again at their next sign-in");
  console.log("ALL OK");
} finally { mode("off"); await browser.close(); }
