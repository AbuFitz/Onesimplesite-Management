import { notFound } from "next/navigation";
import Link from "next/link";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getPostWithComments, reactionsFor, teamNames, CHANNELS } from "@/modules/notes/service";
import { deletePostAction, pinAction, deleteCommentAction } from "@/app/actions/board";
import { ConfirmForm } from "@/components/confirm-form";
import { NoteEditor } from "@/components/note-editor";
import { NoteView } from "@/components/note-view";
import { CommentForm, VisBadge } from "@/components/board-ui";
import { ReactionBar } from "@/components/reaction-bar";
import { MentionText } from "@/components/mention-text";
import { Avatar, timeAgo } from "@/components/ui";

export const metadata = { title: "Team Board" };
export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const r = await getPostWithComments(ctx, id);
  if (!r) notFound();
  const { post, author, comments } = r;
  const [react, team] = await Promise.all([reactionsFor(ctx, id), teamNames(ctx)]);
  const names = [...team.map((p) => p.displayName), ctx.name];
  const manage = post.ownerId === ctx.staffId || ctx.role === "owner";
  const write = can(ctx.role, "notes.write");
  return (
    <div className="bt">
      <Link href="/board" className="bt-back">‹ Board</Link>
      <article className="bt-card">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <Avatar name={author.displayName} size={40} staffId={author.id} />
          <div className="min-w-[9.5rem] flex-1"><p className="font-semibold">{author.displayName}{author.jobTitle && <span className="font-normal text-muted"> · {author.jobTitle}</span>}</p><p className="text-sm text-muted">Posted {timeAgo(post.createdAt)}</p></div>
          <VisBadge v={post.visibility} />{post.channel !== "general" && <span className="chan-pill">{CHANNELS.find(([c]) => c === post.channel)?.[1]}</span>}
          {manage && write && (
            <div className="flex gap-1.5">
              <form action={pinAction}><input type="hidden" name="id" value={post.id} /><input type="hidden" name="pin" value={post.pinned ? "0" : "1"} /><button className="btn btn-quiet !min-h-11 sm:!min-h-9 gap-1.5 px-3 text-sm">{post.pinned ? <PinOff size={14} aria-hidden /> : <Pin size={14} aria-hidden />}{post.pinned ? "Unpin" : "Pin"}</button></form>
              <ConfirmForm action={deletePostAction} message="Delete this post and its comments? This can't be undone."><input type="hidden" name="id" value={post.id} /><button className="btn btn-quiet !min-h-11 sm:!min-h-9 gap-1.5 px-3 text-sm text-danger" aria-label="Delete this post"><Trash2 size={14} aria-hidden />Delete</button></ConfirmForm>
            </div>
          )}
        </header>
        {manage && write ? (
          <NoteEditor key={post.id} id={post.id} mine canWrite initial={{ title: post.title, body: post.body, version: post.version, visibility: post.visibility === "private" ? "private" : "team" }} />
        ) : (
          <><h1 className="mb-4 text-3xl font-bold tracking-tight">{post.title}</h1><NoteView body={post.body} /></>
        )}
        <ReactionBar noteId={post.id} targetType="note" targetId={post.id} initial={react.get(post.id) ?? []} canReact={write} />
      </article>

      <section className="bt-replies" aria-labelledby="cm-h">
        <h2 id="cm-h" className="bt-h">{comments.length === 0 ? "Replies" : `${comments.length} ${comments.length > 1 ? "replies" : "reply"}`}</h2>
        <ul className="bt-list">
          {comments.map((c, i) => {
            const same = i > 0 && comments[i - 1].authorId === c.authorId && +c.createdAt - +comments[i - 1].createdAt < 10 * 60e3;
            return (
              <li key={c.id} className={`bt-r ${same ? "cont" : ""}`}>
                <span className="bt-av">{same ? null : <Avatar name={c.author.displayName} size={36} staffId={c.author.id} />}</span>
                <div className="bt-body">
                  {!same && <p className="bt-who"><b>{c.author.displayName}</b><time>{timeAgo(c.createdAt)}</time></p>}
                  <p className="bt-txt"><MentionText text={c.body} names={names} /></p>
                  <ReactionBar noteId={post.id} targetType="comment" targetId={c.id} initial={react.get(c.id) ?? []} canReact={write} />
                  {(c.authorId === ctx.staffId || ctx.role === "owner") && (
                    <ConfirmForm action={deleteCommentAction} message="Delete this reply?" className="bt-del"><input type="hidden" name="id" value={post.id} /><input type="hidden" name="commentId" value={c.id} /><button>Delete</button></ConfirmForm>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
        {write && <div className="bt-compose"><CommentForm id={post.id} name={ctx.name} staffId={ctx.staffId} people={team} /></div>}
      </section>
    </div>
  );
}
