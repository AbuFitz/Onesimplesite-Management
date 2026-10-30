import type { StaffRole } from "@/generated/prisma/enums";

export const CAPS = [
  "customer.read", "customer.write", "customer.archive",
  "opportunity.write", "proposal.write", "proposal.send", "proposal.withdraw",
  "contract.send", "contract.record_completion", "contract.void",
  "project.read_all", "project.read_assigned", "project.write",
  "billing.read", "billing.write", "billing.refund",
  "calendar.write", "notes.write", "audit.read", "staff.manage", "settings.write", "email.send_as_department", "data.export", "vault.use",
] as const;
export type Cap = (typeof CAPS)[number];

const ALL = new Set<Cap>(CAPS);
const without = (...c: Cap[]) => new Set(CAPS.filter((x) => !c.includes(x)));

export const ROLE_CAPS: Record<StaffRole, ReadonlySet<Cap>> = {
  owner: ALL,
  // Everyone on the team gets every business capability, but cannot manage logins or settings.
  member: without("staff.manage"),
  client_director: without("staff.manage", "settings.write", "billing.refund", "audit.read"),
  delivery: new Set<Cap>(["vault.use", "customer.read", "project.read_assigned", "project.write", "calendar.write", "notes.write"]),
  sales: new Set<Cap>(["vault.use", "customer.read", "customer.write", "opportunity.write", "proposal.write", "proposal.send", "calendar.write", "notes.write"]),
  support: new Set<Cap>(["vault.use", "customer.read", "project.read_all", "calendar.write", "notes.write"]),
  finance: new Set<Cap>(["vault.use", "customer.read", "billing.read", "billing.write", "calendar.write", "notes.write"]),
};

export const can = (role: StaffRole, cap: Cap) => ROLE_CAPS[role].has(cap);

/** Plain-language summary shown on the Team page. The capability table above is the source of truth. */
export const ROLE_INFO: Record<StaffRole, { label: string; summary: string }> = {
  owner: { label: "Owner", summary: "Everything, including team members, roles and settings." },
  member: { label: "Team member (recommended)", summary: "Full access to customers, proposals, contracts, projects, billing, calendar and notes. Can edit Settings and Terms. Cannot see or manage other people's logins." },
  client_director: { label: "Client director", summary: "All customers, proposals, contracts and projects. Cannot manage the team or settings." },
  delivery: { label: "Delivery", summary: "Projects they own, plus calendar and notes. Cannot see customers' proposals or contracts." },
  sales: { label: "Sales", summary: "Customers, pipeline, proposals (create and send). Cannot record contract completion or see billing." },
  support: { label: "Support", summary: "Read customers and all projects. Cannot edit proposals, contracts or billing." },
  finance: { label: "Finance", summary: "Read customers, plus billing. Cannot edit proposals, contracts or projects." },
};
