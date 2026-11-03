import { notFound } from "next/navigation";
import Link from "next/link";
import { Pin, PinOff, Trash2 } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { getPostWithComments } from "@/modules/notes/service";
import { deletePostAction, pinAction, deleteCommentAction } from "@/app/actions/board";
import { ConfirmForm } from "@/components/confirm-form";
import { NoteEditor } from "@/components/note-editor";
import { NoteView } from "@/components/note-view";
import { CommentForm, VisBadge } from "@/components/board-ui";
import { Avatar, timeAgo } from "@/components/ui";

export const metadata = { title: "Team Board" };
export default async function Post({ params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireStaff();
  const { id } = await params;
  const r = await getPostWithComments(ctx, id);
  if (!r) notFound();
  const { post, author, comments } = r;
  const manage = post.ownerId === ctx.staffId || ctx.role === "owner";
  const write = can(ctx.role, "notes.write");
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/board" className="mb-4 inline-flex min-h-9 items-center text-sm text-muted hover:text-ink">‹ Team Board</Link>
      <article className="rounded-xl border border-[var(--card-line)] bg-white p-5 sm:p-8">
        <header className="mb-5 flex flex-wrap items-center gap-3">
          <Avatar name={author.displayName} size={40} />
          <div className="min-w-0 flex-1"><p className="font-semibold">{author.displayName}{author.jobTitle && <span className="font-normal text-muted"> · {author.jobTitle}</span>}</p><p className="text-sm text-muted">Posted {timeAgo(post.createdAt)}</p></div>
          <VisBadge v={post.visibility} />
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
      </article>

      <section className="mt-8" aria-labelledby="cm-h">
        <h2 id="cm-h" className="mb-4 text-base">{comments.length === 0 ? "Comments" : `${comments.length} comment${comments.length > 1 ? "s" : ""}`}</h2>
        <ul className="mb-5 space-y-4">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-3">
              <Avatar name={c.author.displayName} size={32} />
              <div className="min-w-0 flex-1 rounded-2xl bg-soft px-4 py-3">
                <p className="text-sm"><span className="font-semibold">{c.author.displayName}</span> <span className="text-muted">· {timeAgo(c.createdAt)}</span></p>
                <p className="mt-1 whitespace-pre-wrap break-words text-[15px]">{c.body}</p>
                {(c.authorId === ctx.staffId || ctx.role === "owner") && (
                  <ConfirmForm action={deleteCommentAction} message="Delete this comment?" className="mt-1"><input type="hidden" name="id" value={post.id} /><input type="hidden" name="commentId" value={c.id} /><button className="text-xs text-muted underline hover:text-danger">Delete</button></ConfirmForm>
                )}
              </div>
            </li>
          ))}
        </ul>
        {write && <CommentForm id={post.id} name={ctx.name} />}
      </section>
    </div>
  );
}
