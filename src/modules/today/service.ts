import { db } from "@/lib/db";
import { TEAM_WAIT_HOURS } from "@/modules/support/reminders";

const DAY = 864e5;
const month = (d: Date) => d.toLocaleString("en-GB", { month: "short", timeZone: "Europe/London" });

/** Everything the Today dashboard draws, in one place. Counts only, so it stays quick. */
export async function todayData(workspaceId: string, opts: { staffId: string; seeBusiness: boolean }) {
  const w = workspaceId, now = new Date();
  const weekAgo = new Date(+now - 6 * DAY); weekAgo.setHours(0, 0, 0, 0);
  const sixMonths = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  if (!opts.seeBusiness) return null;
  const [byStatus, recent, paid, monthly, due, pastDue, pipeline, awaiting, needsReply, projects] = await Promise.all([
    db.ticket.groupBy({ by: ["status"], where: { workspaceId: w }, _count: true }),
    db.ticket.findMany({ where: { workspaceId: w, createdAt: { gte: weekAgo } }, select: { createdAt: true } }),
    db.billingIntent.findMany({ where: { workspaceId: w, status: { in: ["paid", "active"] }, paidAt: { gte: sixMonths } }, select: { paidAt: true, amountMinor: true } }),
    // A free care period that simply ends is not income, so it is left out of the monthly total.
    db.billingIntent.aggregate({ where: { workspaceId: w, kind: "recurring_setup", status: "active", OR: [{ paidVia: null }, { paidVia: { not: "free" } }] }, _sum: { amountMinor: true }, _count: true }),
    // Money we can ask for now. A final payment not yet requested is shown as due before launch, not as overdue.
    db.billingIntent.aggregate({ where: { workspaceId: w, status: "pending", NOT: [{ kind: "recurring_setup" }, { kind: "balance", requestedAt: null }] }, _sum: { amountMinor: true }, _count: true }),
    db.billingIntent.count({ where: { workspaceId: w, status: "past_due" } }),
    db.opportunity.groupBy({ by: ["stage"], where: { workspaceId: w }, _count: true }),
    db.contract.count({ where: { workspaceId: w, status: "awaiting_signature" } }),
    db.ticket.findMany({ where: { workspaceId: w, status: { in: ["open", "customer_replied"] } }, include: { customer: { select: { displayName: true } }, contact: { select: { name: true } } }, orderBy: { updatedAt: "asc" }, take: 6 }),
    db.project.groupBy({ by: ["stage"], where: { workspaceId: w }, _count: true }),
  ]);
  const days = Array.from({ length: 7 }, (_, i) => { const d = new Date(+weekAgo + i * DAY); return { key: d.toDateString(), label: d.toLocaleString("en-GB", { weekday: "short", timeZone: "Europe/London" }).slice(0, 3), value: 0 }; });
  for (const t of recent) { const k = new Date(t.createdAt).toDateString(); const d = days.find((x) => x.key === k); if (d) d.value++; }
  const months = Array.from({ length: 6 }, (_, i) => { const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1); return { key: `${d.getFullYear()}-${d.getMonth()}`, label: month(d), value: 0 }; });
  for (const p of paid) { if (!p.paidAt) continue; const k = `${p.paidAt.getFullYear()}-${p.paidAt.getMonth()}`; const m = months.find((x) => x.key === k); if (m) m.value += Math.round(p.amountMinor / 100); }
  const st = (s: string) => byStatus.find((x) => x.status === s)?._count ?? 0;
  const open = st("open") + st("customer_replied") + st("in_progress"), waiting = st("waiting_customer"), done = st("resolved") + st("closed");
  // How many of the tickets that need us are still inside the time we aim to reply in.
  const inTime = needsReply.filter((t) => (+now - +(t.lastCustomerAt ?? t.createdAt)) / 36e5 < (TEAM_WAIT_HOURS[t.priority as keyof typeof TEAM_WAIT_HOURS] ?? 24)).length;
  const stageOf = (s: string) => projects.find((x) => x.stage === s)?._count ?? 0;
  const live = stageOf("launched") + stageOf("completed");
  const total = projects.reduce((n, p) => n + p._count, 0);
  return {
    tickets: { open, waiting, done, replied: st("customer_replied"), fresh: st("open") },
    week: days, months,
    money: { monthlyMinor: monthly._sum.amountMinor ?? 0, plans: monthly._count, dueMinor: due._sum.amountMinor ?? 0, dueCount: due._count, pastDue },
    pipeline: Object.fromEntries(pipeline.map((p) => [p.stage, p._count])) as Record<string, number>,
    awaiting, needsReply,
    replyHealth: needsReply.length ? inTime / needsReply.length : 1,
    projects: { total, live, building: total - live - stageOf("cancelled") - stageOf("planned") - stageOf("awaiting_assets"), starting: stageOf("planned") + stageOf("awaiting_assets"), stages: projects },
  };
}
