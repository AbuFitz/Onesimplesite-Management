import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { saveNotifyPrefs } from "@/modules/settings/plans";
import { NOTIFY_EVENTS, DELIVERY_LABEL, prefsFrom } from "@/modules/settings/notifications";
import { SubmitButton } from "@/components/submit-button";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "Notifications" };

async function save(fd: FormData) {
  "use server";
  const ctx = await requireStaff("settings.write");
  await saveNotifyPrefs(ctx, Object.fromEntries(NOTIFY_EVENTS.map((e) => [e.topic, fd.get(e.topic)])));
  redirect("/settings/notifications?saved=1");
}

export default async function Notifications({ searchParams }: { searchParams: Promise<{ saved?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  const w = await db.workspace.findUniqueOrThrow({ where: { id: ctx.workspaceId }, select: { settings: true } });
  const prefs = prefsFrom(w.settings);
  const sections = [["team", "Emails to the team", "Everything here is also in the app: Tickets, the suggestions bubble, Today and each order. An email is only a nudge."], ["customer", "Optional emails to customers", "Emails customers need (invitations, agreements, receipts, our replies, prices) are always sent and aren't listed."]] as const;
  return (
    <>
      <RecordHeader title="Notifications" meta="Which emails are sent, and when" />
      {sp.saved && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm text-[#0a5a3d]">Saved.</p>}
      <form action={save} className="max-w-3xl">
        {sections.map(([who, title, about]) => (
          <section key={who} className="card-section" aria-labelledby={`n-${who}`}>
            <h2 id={`n-${who}`}>{title}</h2><p className="mb-3 text-sm text-ink/70">{about}</p>
            <ul className="divide-y divide-[var(--card-rule)]">{NOTIFY_EVENTS.filter((e) => e.who === who).map((e) => (
              <li key={e.topic} className="grid gap-2 py-3 sm:grid-cols-[1fr_15rem] sm:items-center">
                <div><label className="font-semibold" htmlFor={e.topic}>{e.label}</label><p className="text-[13px] text-ink/65">{e.help}</p></div>
                <select id={e.topic} name={e.topic} className="field" defaultValue={prefs[e.topic] && e.modes.includes(prefs[e.topic]!) ? prefs[e.topic] : e.default}>{e.modes.map((m) => <option key={m} value={m}>{DELIVERY_LABEL[m]}{m === e.default ? " (recommended)" : ""}</option>)}</select>
              </li>))}</ul>
          </section>
        ))}
        <p className="mb-4 text-sm text-ink/70">The daily summary is one email a day (from 7am) listing everything held back, so nothing is lost and your inbox stays quiet.</p>
        <SubmitButton pendingText="Saving…">Save notification settings</SubmitButton>
      </form>
    </>
  );
}
