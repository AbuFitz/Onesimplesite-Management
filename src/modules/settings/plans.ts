import { z } from "zod";
import { db } from "@/lib/db";
import { audit } from "@/lib/audit";
import { DomainError, forbidden, notFound } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";
import { VARIABLES, fillVars, type VarDef } from "./variables";
import { getCompany } from "./service";

const need = (ctx: StaffCtx) => { if (!can(ctx.role, "settings.write")) throw forbidden(); };
export const money = (minor: number) => `£${(minor / 100).toFixed(2)}`;

export const listPlans = (workspaceId: string, onlyActive = false) => db.servicePlan.findMany({ where: { workspaceId, ...(onlyActive ? { active: true } : {}) }, orderBy: [{ position: "asc" }, { name: "asc" }] });

const planInput = z.object({
  name: z.string().trim().min(1, "Give the plan a name.").max(80),
  kind: z.enum(["standard", "ecommerce", "custom"]).default("custom"),
  price: z.coerce.number().min(0, "The price can't be negative.").max(10000),
  revisionsPerMonth: z.coerce.number().int().min(0).max(100),
  backupFrequency: z.string().trim().max(60).optional().transform((v) => v || null),
  backupRetention: z.string().trim().max(60).optional().transform((v) => v || null),
  summary: z.string().trim().max(300).optional().transform((v) => v || null),
  active: z.coerce.boolean().default(true),
});

const slug = (s: string) => s.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "plan";

export async function savePlan(ctx: StaffCtx, id: string | null, raw: unknown) {
  need(ctx);
  const i = planInput.parse(raw);
  const data = { name: i.name, kind: i.kind, monthlyMinor: Math.round(i.price * 100), revisionsPerMonth: i.revisionsPerMonth, backupFrequency: i.backupFrequency, backupRetention: i.backupRetention, summary: i.summary, active: i.active };
  await db.$transaction(async (tx) => {
    if (id) {
      if (!(await tx.servicePlan.findFirst({ where: { id, workspaceId: ctx.workspaceId }, select: { id: true } }))) throw notFound();
      await tx.servicePlan.update({ where: { id }, data });
    } else {
      let key = slug(i.name); let n = 1;
      while (await tx.servicePlan.findFirst({ where: { workspaceId: ctx.workspaceId, key }, select: { id: true } })) key = `${slug(i.name)}-${++n}`;
      await tx.servicePlan.create({ data: { ...data, workspaceId: ctx.workspaceId, key, position: 100 } });
    }
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: id ? "plan.updated" : "plan.created", targetType: "plan", targetId: id ?? i.name, detail: { name: i.name, monthlyMinor: data.monthlyMinor } });
  });
}

// ───────── Settings values ─────────
export async function getSettings(workspaceId: string): Promise<Record<string, string>> {
  const w = await db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { settings: true } });
  return (w.settings ?? {}) as Record<string, string>;
}

export async function saveSettings(ctx: StaffCtx, fields: Record<string, unknown>) {
  need(ctx);
  const allowed = new Map(VARIABLES.map((v) => [v.key, v]));
  const clean: Record<string, string> = {};
  for (const [k, v] of Object.entries(fields)) { if (allowed.has(k)) clean[k] = String(v ?? "").trim().slice(0, 600); }
  await db.$transaction(async (tx) => {
    const cur = ((await tx.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } })).settings ?? {}) as Record<string, string>;
    await tx.workspace.update({ where: { id: ctx.workspaceId }, data: { settings: { ...cur, ...clean } } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "settings.values_updated", targetType: "workspace", targetId: ctx.workspaceId, detail: { keys: Object.keys(clean) } });
  });
}

/** Every value a document can quote, for this workspace and (optionally) the plan being sold. */
export async function documentValues(workspaceId: string, planId?: string | null): Promise<Record<string, string>> {
  const [company, stored, plans] = await Promise.all([
    db.workspace.findUniqueOrThrow({ where: { id: workspaceId }, select: { legalName: true, registeredAddress: true } }),
    getSettings(workspaceId), listPlans(workspaceId),
  ]);
  const out: Record<string, string> = {};
  for (const v of VARIABLES as VarDef[]) out[v.key] = (stored[v.key]?.trim() || v.default || "");
  out.legal_name = company.legalName ?? "";
  out.registered_office = (company.registeredAddress ?? "").replace(/\s*\n\s*/g, ", ");
  out.privacy_email = "privacy@onesimplesite.co.uk";
  for (const p of plans) { if (p.kind === "standard") out.care_standard = money(p.monthlyMinor); if (p.kind === "ecommerce") out.care_ecommerce = money(p.monthlyMinor); }
  const plan = planId ? plans.find((p) => p.id === planId) : undefined;
  if (plan) { out.backup_frequency = plan.backupFrequency ?? ""; out.backup_retention = plan.backupRetention ?? ""; out.care_revisions = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"][plan.revisionsPerMonth] ?? String(plan.revisionsPerMonth); }
  return out;
}
export { fillVars };
void DomainError; void getCompany;
