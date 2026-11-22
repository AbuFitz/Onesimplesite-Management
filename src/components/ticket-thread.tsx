import { Lock } from "lucide-react";
import { Avatar } from "./ui";
import { Files } from "./file-picker";

type Msg = { id: string; authorKind: string; internal: boolean; authorName: string; authorUserId?: string | null; body: string; createdAt: Date };
type F = { id: string; commentId: string | null } & Record<string, unknown>;
const full = (d: Date) => new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Europe/London" }).format(d);

/**
 * A ticket's record: the request first, then everything that happened in order, each entry labelled with who it is from.
 * Not a chat: replies are entries on a ticket, private notes are clearly marked, and status changes sit on the line between them.
 */
export function TicketThread({ first, comments, files, base = "/api/files", avatarBase = "/api/avatar/u" }: { first: Msg; comments: Msg[]; files: F[]; base?: string; avatarBase?: string }) {
  const entry = (m: Msg, isFirst: boolean) => {
    const att = <Files base={base} items={files.filter((f) => (isFirst ? !f.commentId : f.commentId === m.id)) as never} />;
    const team = m.authorKind === "staff";
    if (m.internal) return (
      <li key={m.id} className="tl2-item"><span className="tl2-dot note" aria-hidden><Lock size={11} /></span>
        <article className="tl2-card note"><header><b>{m.authorName}</b><span className="tl2-tag note">Private note</span><time title={full(m.createdAt)}>{full(m.createdAt)}</time></header><p className="tl2-txt">{m.body}</p>{att}</article></li>
    );
    return (
      <li key={m.id} className="tl2-item"><span className="tl2-dot" aria-hidden />
        <article className={`tl2-card ${team ? "team" : "cust"} ${isFirst ? "first" : ""}`}>
          <header><Avatar name={m.authorName} size={26} staffId={m.authorUserId ?? undefined} base={avatarBase} /><b>{m.authorName}</b><span className={`tl2-tag ${team ? "team" : "cust"}`}>{isFirst ? "Request" : team ? "Reply from us" : "Customer"}</span><time title={full(m.createdAt)}>{full(m.createdAt)}</time></header>
          <p className="tl2-txt">{m.body}</p>{att}
        </article></li>
    );
  };
  return (
    <ol className="tl2" aria-label="Ticket activity">
      {entry(first, true)}
      {comments.map((m) => m.authorKind === "event"
        ? <li key={m.id} className="tl2-item ev"><span className="tl2-dot ev" aria-hidden /><p className="tl2-ev">{m.body}<time>{full(m.createdAt)}</time></p></li>
        : entry(m, false))}
    </ol>
  );
}
