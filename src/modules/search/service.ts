import { db } from "@/lib/db";
import { can } from "@/modules/identity/permissions";
import { projectWhere } from "@/modules/projects/service";
import { visibleNotes } from "@/modules/notes/service";
import type { StaffCtx } from "@/modules/identity/session";

const ci = (q: string) => ({ contains: q, mode: "insensitive" as const });

/** Permission-aware: each source is only queried if the role may read it, and always scoped to the workspace. */
export async function searchAll(ctx: StaffCtx, raw: string) {
  const q = raw.trim().slice(0, 80);
  if (q.length < 2) return { q, groups: [] as { title: string; items: { href: string; title: string; sub: string }[] }[] };
  const w = ctx.workspaceId, take = 6;
  const seeC = can(ctx.role, "customer.read");
  const [customers, contacts, proposals, contracts, projects, notes] = await Promise.all([
    seeC ? db.customer.findMany({ where: { workspaceId: w, archivedAt: null, OR: [{ displayName: ci(q) }, { legalName: ci(q) }, { reference: ci(q) }] }, take }) : [],
    seeC ? db.contact.findMany({ where: { workspaceId: w, OR: [{ name: ci(q) }, { email: ci(q) }] }, include: { customer: { select: { displayName: true } } }, take }) : [],
    seeC ? db.proposal.findMany({ where: { workspaceId: w, OR: [{ title: ci(q) }, { reference: ci(q) }] }, include: { customer: { select: { displayName: true } } }, take }) : [],
    seeC ? db.contract.findMany({ where: { workspaceId: w, OR: [{ title: ci(q) }, { reference: ci(q) }] }, include: { customer: { select: { displayName: true } } }, take }) : [],
    (can(ctx.role, "project.read_all") || can(ctx.role, "project.read_assigned")) ? db.project.findMany({ where: { ...projectWhere(ctx), OR: [{ name: ci(q) }, { reference: ci(q) }] }, include: { customer: { select: { displayName: true } } }, take }) : [],
    db.note.findMany({ where: { AND: [visibleNotes(ctx), { OR: [{ title: ci(q) }, { body: ci(q) }] }] }, take }),
  ]);
  const groups = [
    { title: "Customers", items: customers.map((c) => ({ href: `/customers/${c.id}`, title: c.displayName, sub: `${c.reference} · ${c.lifecycle}` })) },
    { title: "Contacts", items: contacts.map((c) => ({ href: `/customers/${c.customerId}`, title: c.name, sub: `${c.email ?? "no email"} · ${c.customer.displayName}` })) },
    { title: "Proposals", items: proposals.map((p) => ({ href: `/proposals/${p.id}`, title: p.title, sub: `${p.reference} · ${p.customer.displayName} · ${p.status}` })) },
    { title: "Agreements", items: contracts.map((k) => ({ href: `/contracts/${k.id}`, title: k.title, sub: `${k.reference} · ${k.customer.displayName} · ${k.status.replace("_", " ")}` })) },
    { title: "Projects", items: projects.map((p) => ({ href: `/projects/${p.id}`, title: p.name, sub: `${p.reference} · ${p.customer.displayName}` })) },
    { title: "Notes", items: notes.map((n) => ({ href: `/notes/${n.id}`, title: n.title, sub: n.visibility === "private" ? "Private" : "Team" })) },
  ].filter((g) => g.items.length);
  return { q, groups };
}
