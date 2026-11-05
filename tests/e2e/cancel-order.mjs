// Calling off a signed order: gone from the open lists, projects and the customer's billing, shown as Cancelled, never as Signed.
import { createRequire } from "node:module";
const { chromium } = createRequire(import.meta.url)("playwright");
import { execSync } from "node:child_process";
import { writeFileSync, rmSync } from "node:fs";
const M = "http://manage.localhost:3000", P = "http://portal.localhost:3000";
const ok = (c, m) => { if (!c) throw new Error("FAIL: " + m); console.log("ok  -", m); };
writeFileSync("seed-cancel.tmp.ts", `
import { db } from "@/lib/db";
import { runCompletionWorkflow } from "@/modules/contracts/service";
const u = await db.user.findFirstOrThrow({ where: { email: "client.b@example.test" } });
const m = await db.clientMembership.findFirstOrThrow({ where: { userId: u.id } });
const cu = await db.customer.findUniqueOrThrow({ where: { id: m.customerId } });
const n = Date.now() % 1000000;
const p = await db.proposal.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: "OSS-QT-CX-" + n, title: "Cancel test " + n, currentVersion: 1, status: "accepted" } });
const v = await db.proposalVersion.create({ data: { workspaceId: cu.workspaceId, proposalId: p.id, number: 1, scope: "x", terms: "", currency: "GBP", oneOffMinor: 20000, recurringMinor: 0, requirements: { depositPercent: "50" } } });
const k = await db.contract.create({ data: { workspaceId: cu.workspaceId, customerId: cu.id, reference: "OSS-OF-CX-" + n, title: "Cancel test " + n, status: "completed", scopeSnapshot: "x", oneOffMinor: 20000, recurringMinor: 0, proposalVersionId: v.id, completedAt: new Date() } });
await db.$transaction((tx) => runCompletionWorkflow(tx, k.id));
console.log("CONTRACT=" + k.id + " TITLE=" + k.title);
process.exit(0);`);
const out = execSync("npx tsx --env-file=.env seed-cancel.tmp.ts 2>&1", { encoding: "utf8" }); rmSync("seed-cancel.tmp.ts");
const id = out.match(/CONTRACT=([0-9a-f-]{36})/)[1], title = out.match(/TITLE=(.+)/)[1].trim();
const b = await chromium.launch();
async function login(origin, email) { const ctx = await b.newContext({ viewport: { width: 1280, height: 900 } }); const p = await ctx.newPage(); await p.goto(`${origin}/login`); await p.fill("#email", email); await p.fill("#password", "demo-password-123"); await p.click("button:has-text('Sign in')"); await p.waitForURL((u) => !u.pathname.startsWith("/login")); return p; }
const st = await login(M, "demo.owner@example.test"), cl = await login(P, "client.b@example.test");
const listText = async (path) => { await st.goto(`${M}${path}`); await st.waitForLoadState("networkidle"); return st.locator("main").innerText(); };
// before: it is a signed order, with a project, and the customer can see its deposit
ok((await listText("/agreements")).includes(title), "before: the signed order is in the open list");
await st.goto(`${M}/projects`); await st.waitForLoadState("networkidle"); ok((await st.locator("main").innerText()).includes(title), "before: its project is in Projects");
await cl.goto(`${P}/billing`); await cl.waitForLoadState("networkidle"); ok((await cl.locator("main").innerText()).includes(title), "before: the customer sees its charges");
// cancel it
await st.goto(`${M}/contracts/${id}`); await st.waitForLoadState("networkidle");
await st.locator("summary:has-text('Cancel this order')").click();
await st.fill("#cr", "E2E: customer pulled out");
await st.click("button:has-text('Cancel the order')"); await st.waitForSelector("text=Tick the box").catch(() => {});
ok(await st.locator("text=Tick the box to confirm").count() >= 1, "it will not cancel until the box is ticked");
await st.locator("summary:has-text('Cancel this order')").click().catch(() => {});
await st.fill("#cr", "E2E: customer pulled out"); await st.check("input[name=sure]");
await st.click("button:has-text('Cancel the order')"); await st.waitForSelector("text=Order cancelled");
ok(true, "cancelling works and says what it did");
ok(await st.locator("text=Cancelled").count() >= 1, "the order shows as Cancelled, not Signed");
// after
ok(!(await listText("/agreements")).includes(title), "after: gone from the open agreements list");
const closed = await listText("/agreements?show=closed"); ok(closed.includes(title) && /Cancelled/.test(closed), "after: listed under Cancelled, declined or expired, labelled Cancelled");
ok(!(await listText("/projects")).includes(title), "after: its project is gone from Projects");
ok((await listText("/projects?stage=cancelled")).includes(title), "after: and is under the Cancelled chip");
const pay = await listText("/payments?show=due"); ok(!pay.includes(title), "after: nothing from it is to collect");
await cl.goto(`${P}/billing`); await cl.waitForLoadState("networkidle"); ok(!(await cl.locator("main").innerText()).includes(title), "after: the customer no longer sees its charges");
await cl.goto(`${P}/projects`); await cl.waitForLoadState("networkidle"); ok(!(await cl.locator("main").innerText()).includes(title), "after: nor its project");
await b.close(); console.log("ALL OK");
