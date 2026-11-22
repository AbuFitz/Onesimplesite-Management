import Link from "next/link";
import { ArrowRight, Check } from "lucide-react";
import { clientCanAny } from "@/modules/portal/access";
import { requireClient } from "@/modules/identity/session";
import { clientOverview, STAGE_COPY } from "@/modules/portal/service";
import { clientTickets } from "@/modules/support/service";
import { clientBilling, isScheduled, KIND_LABEL, money } from "@/modules/billing/service";
import { greeting, todayLabel } from "@/lib/greeting";
import { fmtDate, timeAgo } from "@/components/ui";

export const metadata = { title: "Home" };

const STEPS = ["Planning", "Design", "Build", "Review", "Live"] as const;
const stepOf = (stage: string) => ({ planned: 0, awaiting_assets: 0, design: 1, development: 2, qa: 2, client_review: 3, ready_to_launch: 3, launched: 4, completed: 4 } as Record<string, number>)[stage] ?? 0;

export default async function PortalOverview() {
  const c = await requireClient();
  const canBill = clientCanAny(c, "billing");
  const [o, tickets, bills] = await Promise.all([clientOverview(c), clientTickets(c), canBill ? clientBilling(c) : Promise.resolve([])]);
  const first = (c.name ?? "").split(" ")[0] || "there";
  const current = o.projects.find((p) => !["completed", "cancelled"].includes(p.stage));
  const mine = current ? o.assets.filter((x) => x.projectId === current.id) : o.assets;
  const open = tickets.filter((t) => !["resolved", "closed"].includes(t.status)); // every ticket in the company that is still live, whoever raised it
  const needsYou = tickets.filter((t) => t.status === "waiting_customer");
  const step = current ? stepOf(current.stage) : 0;
  const due = bills.filter((b) => b.status === "pending" && !isScheduled(b) && b.kind !== "recurring_setup");
  const dueMinor = due.reduce((n, b) => n + b.amountMinor, 0);
  const depositPaid = bills.some((b) => b.kind === "deposit" && ["paid", "active"].includes(b.status));

  // The one thing most worth doing next, in plain words. Always something, even if it is "nothing to do".
  const next = needsYou[0] ? { title: `Reply to “${needsYou[0].title}”`, body: "We've replied. A quick answer keeps things moving.", href: `/help/${needsYou[0].id}`, cta: "Open the conversation", tone: "sky" }
    : due[0] ? { title: `Pay your ${(KIND_LABEL[due[0].kind] ?? "payment").toLowerCase()}`, body: `${money(dueMinor)} is ready to pay by card on a secure page.`, href: "/billing", cta: "Pay securely", tone: "lilac" }
    : mine[0] && current ? { title: `Send us: ${mine[0].label}`, body: mine.length > 1 ? `${mine.length} things are needed to keep your site on track.` : "This is what we need to keep your site on track.", href: `/projects/${current.id}`, cta: "Send it now", tone: "peach" }
    : current ? { title: STEPS[step], body: STAGE_COPY[current.stage] ?? "We're working on it.", href: `/projects/${current.id}`, cta: "See your project", tone: "lime" }
    : { title: "You're all up to date", body: "Nothing needs you right now. We'll tell you when something comes up.", href: "/documents", cta: "Your documents", tone: "lime" };
  const todo = needsYou.length + (due.length ? 1 : 0) + mine.length;

  const ready = [
    { label: "Agreement signed", done: o.documents.length > 0, hint: "Your signed copy appears under Documents." },
    ...(canBill ? [{ label: "Deposit paid", done: depositPaid, hint: "Pay it from Billing." }] : []),
    { label: "Content and files sent", done: !!current && mine.length === 0, hint: "Send us what we've asked for." },
    { label: "Design approved", done: step >= 3, hint: "We'll ask you to review it." },
    { label: "Live", done: step >= 4, hint: "We launch once everything above is done." },
  ];
  const readyN = ready.filter((r) => r.done).length;

  const stats = [
    { href: "/help", label: "Open tickets", value: open.length, tone: "sky", note: needsYou.length ? `${needsYou.length} we replied to` : "all answered" },
    { href: current ? `/projects/${current.id}` : "/projects", label: "Needed from you", value: mine.length, tone: "peach", note: mine.length ? "to keep on track" : "all sent" },
    { href: "/documents", label: "Documents", value: o.documents.length, tone: "mint", note: "signed and shared" },
    ...(canBill ? [{ href: "/billing", label: "To pay", value: dueMinor ? money(dueMinor) : "£0", tone: "lilac", note: due.length ? `${due.length} ${due.length === 1 ? "payment" : "payments"}` : "all paid up" }] : []),
  ];

  return (
    <div className="pv">
      <header className="pv-hello">
        <p>{todayLabel()}</p>
        <h1 id="hi">{greeting()}, {first}</h1>
        <p className={`pv-chip ${todo ? "" : "ok"}`}><i aria-hidden />{todo ? `${todo} ${todo === 1 ? "thing" : "things"} to look at` : "All up to date"}</p>
      </header>

      <section className={`nx nx-${next.tone}`} aria-labelledby="nx-t">
        <i className="nx-b1" aria-hidden /><i className="nx-b2" aria-hidden /><i className="nx-b3" aria-hidden />
        <p className="nx-tag">Next up</p>
        <h2 id="nx-t">{next.title}</h2>
        <p className="nx-body">{next.body}</p>
        <div className="nx-act">
          <Link href={next.href} className="btn">{next.cta} <ArrowRight size={16} aria-hidden /></Link>
          {clientCanAny(c, "tickets") && <Link href="/help/new" className="btn btn-quiet">Raise a ticket</Link>}
        </div>
      </section>

      <div className="stat-row" role="list" aria-label="At a glance">
        {stats.map((x) => (
          <Link key={x.label} href={x.href} role="listitem" className={`stat stat-${x.tone}`}>
            <span className="stat-v num">{x.value}</span><span className="stat-l">{x.label}</span><span className="stat-n">{x.note}</span>
          </Link>
        ))}
      </div>

      <div className="pv-grid">
        <section className="card pv-card" aria-labelledby="pj">
          <div className="pv-h"><h2 id="pj">{current ? current.name : "Your project"}</h2>{current && <Link href={`/projects/${current.id}`} className="pv-more">Details <ArrowRight size={15} aria-hidden /></Link>}</div>
          {current ? (
            <>
              <ol className="miles" aria-label="Progress">{STEPS.map((s, i) => <li key={s} data-state={i < step ? "done" : i === step ? "now" : "next"} aria-current={i === step ? "step" : undefined}><i>{i < step ? <Check size={14} aria-hidden /> : i + 1}</i><span>{s}</span></li>)}</ol>
              <p className="pv-now"><b>Right now</b>{STAGE_COPY[current.stage] ?? "We're working on it."}</p>
              {current.dueDate && <p className="pv-aim">Aiming for <strong>{fmtDate(current.dueDate)}</strong></p>}
            </>
          ) : <p className="mt-3 text-muted">Your project will show up here as soon as it starts.</p>}
        </section>

        <section className="card pv-card" aria-labelledby="rd">
          <div className="pv-h"><h2 id="rd">Before we launch</h2><span className="pv-count num">{readyN}/{ready.length}</span></div>
          <ul className="ready">{ready.map((r) => <li key={r.label} data-done={r.done ? "1" : "0"}><i aria-hidden>{r.done ? <Check size={14} /> : null}</i><span><b>{r.label}</b>{!r.done && <em>{r.hint}</em>}</span><span className="sr-only">{r.done ? "done" : "not done yet"}</span></li>)}</ul>
        </section>

        <section className="card pv-card" aria-labelledby="need">
          <div className="pv-h"><h2 id="need">What we need from you</h2>{mine.length > 0 && current && <Link href={`/projects/${current.id}`} className="pv-more">Send <ArrowRight size={15} aria-hidden /></Link>}</div>
          {mine.length === 0 ? <p className="text-muted">Nothing right now. We'll tell you when something comes up.</p> : (
            <ul className="pv-list">{mine.slice(0, 4).map((x) => <li key={x.id}><span>{x.label}</span>{x.dueDate && <em>by {fmtDate(x.dueDate)}</em>}</li>)}</ul>
          )}
          {mine.length > 0 && <p className="pv-fine">Please never send passwords.</p>}
        </section>

        <section className="card pv-card" aria-labelledby="docs">
          <div className="pv-h"><h2 id="docs">Your documents</h2><Link href="/documents" className="pv-more">All <ArrowRight size={15} aria-hidden /></Link></div>
          {o.documents.length === 0 ? <p className="text-muted">Signed copies of your agreements will appear here.</p> : (
            <ul className="pv-list">{o.documents.map((d) => <li key={d.id}><span>{d.title}</span><em>{d.reference}</em></li>)}</ul>
          )}
        </section>
      </div>

      <section className="card pv-card" aria-labelledby="up">
        <h2 id="up" className="pv-h2">Latest updates</h2>
        {o.updates.length === 0 ? <p className="mt-2 text-muted">No updates yet. We'll post progress here.</p> : (
          <ol className="pv-feed">{o.updates.map((u) => <li key={u.id}><i aria-hidden /><div><p>{timeAgo(u.createdAt)}</p><p className="whitespace-pre-wrap">{u.body}</p></div></li>)}</ol>
        )}
      </section>
    </div>
  );
}
