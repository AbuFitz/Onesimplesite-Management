import { requireStaff } from "@/modules/identity/session";
import { listTeam } from "@/modules/identity/team";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { changeRoleAction, setActiveAction } from "@/app/actions/work";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { queueStatus } from "@/modules/outbox/drain";
import { retryEmailsAction } from "@/app/actions/work";
import { RecordHeader, Status, ErrorSummary } from "@/components/ui";

export const metadata = { title: "Team" };
export default async function Team({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const ctx = await requireStaff("staff.manage");
  const members = await listTeam(ctx);
  const q = await queueStatus(ctx.workspaceId);
  const roles = Object.entries(ROLE_INFO).map(([value, v]) => ({ value, ...v }));
  return (
    <>
      <RecordHeader title="Team" meta="Logins and access levels" />
      <ErrorSummary message={(await searchParams).error} />
      <section aria-labelledby="mem" className="mb-12">
        <h2 id="mem" className="mb-2">Members</h2>
        <ul>
          {members.map((m) => {
            const self = m.id === ctx.staffId;
            return (
              <li key={m.id} className="row py-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="min-w-0"><p className="font-semibold break-words">{m.displayName}{self ? " (you)" : ""}</p><p className="text-sm text-muted break-all">{m.username ? `${m.username} · ` : ""}{m.email}</p>
                  <Status label={m.status} kind={m.status === "active" ? "good" : m.status === "pending" ? "warn" : "bad"} /></div>
                {!self && (
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={changeRoleAction} className="flex items-end gap-2"><input type="hidden" name="id" value={m.id} />
                      <div><label className="sr-only" htmlFor={`r-${m.id}`}>Level for {m.displayName}</label>
                        <select id={`r-${m.id}`} name="role" defaultValue={m.role} className="field w-auto">{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                      <button className="btn btn-quiet">Change level</button></form>
                    <form action={setActiveAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.status === "deactivated" ? "1" : "0"} />
                      <button className="btn btn-quiet">{m.status === "deactivated" ? "Reactivate" : "Deactivate"}</button></form>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="hint mt-2">Deactivating signs the person out everywhere straight away. Their past activity stays on record. Pending people can be given a fresh link below using the same email.</p>
      </section>
      <section aria-labelledby="inv" className="mb-12"><h2 id="inv" className="mb-3">Add or re-invite someone</h2>
        <InviteStaffForm roles={roles} /></section>
      <section aria-labelledby="em" className="mb-12"><h2 id="em" className="mb-2">Email</h2>
        {!q.configured ? <p className="border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Not connected.</strong> Add RESEND_API_KEY in Vercel to start sending. {q.pending} email(s) are waiting and will go out automatically once it is connected.</p>
          : <p className="text-sm">{q.pending} waiting · {q.failed} failed.</p>}
        {q.recent.length > 0 && <ul className="mt-2 text-sm">{q.recent.map((r) => <li key={r.id} className="row py-2"><span className="font-semibold">{r.topic.replace("email.", "")}</span> · {r.status} · tried {r.attempts}×<br /><span className="text-muted break-words">{r.lastError}</span></li>)}</ul>}
        {q.failed > 0 && <form action={retryEmailsAction} className="mt-2"><button className="btn btn-quiet">Retry failed emails</button></form>}
      </section>
      <section aria-labelledby="lv"><h2 id="lv" className="mb-2">What each level can do</h2>
        <ul>{roles.map((r) => <li key={r.value} className="row py-3"><strong>{r.label}</strong><span className="block text-sm text-muted">{r.summary}</span></li>)}</ul></section>
    </>
  );
}
