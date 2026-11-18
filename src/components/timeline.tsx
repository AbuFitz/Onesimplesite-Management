import { FileSignature, CreditCard, Ticket, Users, ShieldCheck, Building2, FolderKanban, type LucideIcon } from "lucide-react";
import { describe, type Group } from "@/modules/activity/describe";

const ICON: Record<Group, LucideIcon> = { agreement: FileSignature, money: CreditCard, ticket: Ticket, people: Users, security: ShieldCheck, company: Building2, project: FolderKanban };
const CUSTOMER = new Set(["contract.signed", "contract.declined", "proposal.accepted", "contract.pdf_downloaded_by_client"]);
export type TimelineEvent = { id: string; action: string; actorLabel: string | null; createdAt: Date };

const day = (d: Date) => {
  const t = new Date(), y = new Date(Date.now() - 864e5), same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(d, t)) return "Today"; if (same(d, y)) return "Yesterday";
  return new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/London" }).format(d);
};
const time = (d: Date) => new Intl.DateTimeFormat("en-GB", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

/** One timeline for everything that happened: grouped by day, each line a sentence with who did it and when. Newest first. */
export function Timeline({ events, empty = "Nothing has happened yet." }: { events: TimelineEvent[]; empty?: string }) {
  if (events.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  const days: { label: string; items: TimelineEvent[] }[] = [];
  for (const e of events) { const l = day(e.createdAt); const last = days[days.length - 1]; if (last?.label === l) last.items.push(e); else days.push({ label: l, items: [e] }); }
  return (
    <div className="tl">
      {days.map((d) => (
        <section key={d.label} aria-label={d.label}>
          <h3 className="tl-day">{d.label}</h3>
          <ol>
            {d.items.map((e) => { const x = describe(e.action); const Icon = ICON[x.group]; return (
              <li key={e.id} className={`tl-row ${x.tone ?? ""}`}>
                <span className="tl-ico" aria-hidden><Icon size={16} /></span>
                <div><p>{x.text}</p><small>{e.actorLabel && e.actorLabel !== "system" ? e.actorLabel : CUSTOMER.has(e.action) ? "The customer" : "Automatic"} · {time(e.createdAt)}</small></div>
              </li>); })}
          </ol>
        </section>
      ))}
    </div>
  );
}
