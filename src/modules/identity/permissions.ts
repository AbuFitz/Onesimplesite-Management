import type { StaffRole } from "@/generated/prisma/enums";

export const CAPS = [
  "customer.read", "customer.write", "customer.archive",
  "opportunity.write", "proposal.write", "proposal.send", "proposal.withdraw",
  "contract.send", "contract.record_completion", "contract.void",
  "project.read_all", "project.read_assigned", "project.write",
  "billing.read", "billing.write", "billing.refund",
  "calendar.write", "notes.write", "audit.read", "staff.manage", "settings.write", "email.send_as_department",
] as const;
export type Cap = (typeof CAPS)[number];

const ALL = new Set<Cap>(CAPS);
const without = (...c: Cap[]) => new Set(CAPS.filter((x) => !c.includes(x)));

export const ROLE_CAPS: Record<StaffRole, ReadonlySet<Cap>> = {
  owner: ALL,
  client_director: without("staff.manage", "settings.write", "billing.refund", "audit.read"),
  delivery: new Set<Cap>(["customer.read", "project.read_assigned", "project.write", "calendar.write", "notes.write"]),
  sales: new Set<Cap>(["customer.read", "customer.write", "opportunity.write", "proposal.write", "proposal.send", "calendar.write", "notes.write"]),
  support: new Set<Cap>(["customer.read", "project.read_all", "calendar.write", "notes.write"]),
  finance: new Set<Cap>(["customer.read", "billing.read", "billing.write", "calendar.write", "notes.write"]),
};

export const can = (role: StaffRole, cap: Cap) => ROLE_CAPS[role].has(cap);
