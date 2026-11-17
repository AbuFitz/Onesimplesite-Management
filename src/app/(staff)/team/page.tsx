import { requireStaff } from "@/modules/identity/session";
import { listTeam } from "@/modules/identity/team";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { changeRoleAction, setActiveAction, setAliasAction, resetTeamTwoStepAction } from "@/app/actions/work";
import { InviteStaffForm } from "@/components/invite-staff-form";
import { MemberManage } from "@/components/member-manage";
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
              <li key={m.id} className="mem">
                <Avatar name={m.displayName} size={44} staffId={m.id} />
                <div className="min-w-0"><p className="mem-n">{m.displayName}{self ? " (you)" : ""}</p><p className="mem-e">{m.username ? `${m.username} · ` : ""}{m.email}</p>
                  <p className="mem-t"><Status label={m.status} kind={m.status === "active" ? "good" : m.status === "pending" ? "warn" : "bad"} /><span className="mem-r">{(ROLE_INFO[m.role as keyof typeof ROLE_INFO]?.label ?? m.role).replace(" (recommended)", "")}</span></p></div>
                <MemberManage m={{ id: m.id, name: m.displayName, role: m.role, status: m.status, alias: m.aliasEmail ?? "", hasUser: !!m.userId }} roles={roles} self={self} owner={ctx.role === "owner"} actions={{ changeRole: changeRoleAction, setActive: setActiveAction, setAlias: setAliasAction, resetTwoStep: resetTeamTwoStepAction }} />
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
