import { requireStaff } from "@/modules/identity/session";
import { listTeam } from "@/modules/identity/team";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { changeRoleAction, setActiveAction, setAliasAction, resetTeamTwoStepAction } from "@/app/actions/work";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { queueStatus } from "@/modules/outbox/drain";
import { retryEmailsAction } from "@/app/actions/work";
import { Avatar, RecordHeader, Status, ErrorSummary } from "@/components/ui";

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
      <section aria-labelledby="mem" className="card-section">
        <h2 id="mem">Members</h2>
        <ul>
          {members.map((m) => {
            const self = m.id === ctx.staffId;
            return (
              <li key={m.id} className="row py-3 grid gap-3 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex min-w-0 gap-3"><Avatar name={m.displayName} size={40} staffId={m.id} /><div className="min-w-0"><p className="font-semibold break-words">{m.displayName}{self ? " (you)" : ""}</p><p className="text-sm text-muted break-all">{m.username ? `${m.username} · ` : ""}{m.email}</p>
                  <Status label={m.status} kind={m.status === "active" ? "good" : m.status === "pending" ? "warn" : "bad"} />
                  <form action={setAliasAction} className="mt-2 flex flex-wrap items-center gap-2 text-sm"><input type="hidden" name="id" value={m.id} /><label htmlFor={`a-${m.id}`} className="text-muted">Customers see emails from</label><input id={`a-${m.id}`} name="alias" defaultValue={m.aliasEmail ?? ""} placeholder="name@onesimplesite.co.uk" className="field !min-h-11 sm:!min-h-9 w-60 !py-1 !text-sm" autoCapitalize="none" /><button className="btn btn-quiet !min-h-11 sm:!min-h-9">Save</button></form></div></div>
                {!self && (
                  <div className="flex flex-wrap items-end gap-2">
                    <form action={changeRoleAction} className="flex items-end gap-2"><input type="hidden" name="id" value={m.id} />
                      <div><label className="sr-only" htmlFor={`r-${m.id}`}>Level for {m.displayName}</label>
                        <select id={`r-${m.id}`} name="role" defaultValue={m.role} className="field w-auto">{roles.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}</select></div>
                      <button className="btn btn-quiet">Change level</button></form>
                    <form action={setActiveAction}><input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.status === "deactivated" ? "1" : "0"} />
                      <button className="btn btn-quiet">{m.status === "deactivated" ? "Reactivate" : "Deactivate"}</button></form>
                    {ctx.role === "owner" && m.userId && <details className="rounded-lg border border-line bg-white px-3 py-1"><summary className="min-h-9 cursor-pointer py-1.5 text-sm font-semibold">Reset two-step</summary><form action={resetTeamTwoStepAction} className="mt-1 mb-2 space-y-2 text-sm"><input type="hidden" name="id" value={m.id} /><p className="max-w-xs text-muted">Removes their authenticator app, passkeys and trusted devices and signs them out. They set it up again at next sign-in.</p><button className="btn !border-[#b3261e] !bg-[#b3261e] !text-white">Reset for {m.displayName.split(" ")[0]}</button></form></details>}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
        <p className="hint mt-2">Deactivating signs the person out everywhere straight away. Their past activity stays on record. Pending people can be given a fresh link below using the same email.</p>
      </section>
      <section aria-labelledby="inv" className="card-section"><h2 id="inv">Add or re-invite someone</h2>
        <InviteStaffForm roles={roles} /></section>
      <section aria-labelledby="em" className="card-section"><h2 id="em">Email</h2>
        {!q.configured ? <p className="border-l-4 border-warn bg-wash px-3 py-2 text-sm"><strong>Not connected.</strong> Add RESEND_API_KEY in Vercel to start sending. {q.pending} email(s) are waiting and will go out automatically once it is connected.</p>
          : <p className="text-sm">{q.pending} waiting · {q.failed} failed.</p>}
        {q.recent.length > 0 && <ul className="mt-2 text-sm">{q.recent.map((r) => <li key={r.id} className="row py-2"><span className="font-semibold">{r.topic.replace("email.", "")}</span> · {r.status} · tried {r.attempts}×<br /><span className="text-muted break-words">{r.lastError}</span></li>)}</ul>}
        {q.failed > 0 && <form action={retryEmailsAction} className="mt-2"><button className="btn btn-quiet">Retry failed emails</button></form>}
      </section>
      <section aria-labelledby="lv" className="card-section"><h2 id="lv">What each level can do</h2>
        <ul>{roles.map((r) => <li key={r.value} className="row py-3"><strong>{r.label}</strong><span className="block text-sm text-muted">{r.summary}</span></li>)}</ul></section>
    </>
  );
}
