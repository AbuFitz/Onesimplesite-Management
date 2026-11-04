import type { ClientCtx } from "./service";

/** What a person can do inside their company's portal. Plain data: safe to import in the browser. */
export const ACCESS_LEVELS = [
  { id: "admin", label: "Owner", blurb: "Everything, including billing and who else has access." },
  { id: "member", label: "Team member", blurb: "Follow projects, see documents and raise tickets." },
  { id: "viewer", label: "View only", blurb: "Follow projects and see documents. Can't raise tickets." },
] as const;
export type AccessLevel = (typeof ACCESS_LEVELS)[number]["id"];
export const levelLabel = (id: string) => ACCESS_LEVELS.find((l) => l.id === id)?.label ?? id;

export type ClientCap = "tickets" | "billing" | "people";
type M = { role: string; billing?: boolean };

/** Owners can do everything. Team members can raise tickets. Billing is a separate switch so an accountant can pay invoices without seeing projects' tickets. */
export function memberCan(m: M, cap: ClientCap): boolean {
  if (m.role === "admin") return true;
  if (cap === "billing") return !!m.billing;
  if (cap === "tickets") return m.role === "member";
  return false;
}
/** Can this person do it for one specific company? */
export const clientCan = (c: ClientCtx, customerId: string, cap: ClientCap) => { const m = c.memberships.find((x) => x.customerId === customerId); return !!m && memberCan(m, cap); };
/** Can they do it for at least one of their companies? */
export const clientCanAny = (c: ClientCtx, cap: ClientCap) => c.memberships.some((m) => memberCan(m, cap));
export const customersWhere = (c: ClientCtx, cap: ClientCap) => c.memberships.filter((m) => memberCan(m, cap)).map((m) => m.customerId);
