import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { createPost, listPosts, getPostWithComments, addComment, deleteComment, deletePost, setPinned, saveNote } from "@/modules/notes/service";
import type { StaffCtx } from "@/modules/identity/session";

async function team() {
  const w = await db.workspace.create({ data: { name: `board-${Math.random()}` } });
  const mk = async (role: StaffCtx["role"], name: string): Promise<StaffCtx> => {
    const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `${name}-${Math.random()}@example.test`, displayName: name, role, status: "active" } });
    return { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role, name, email: m.email };
  };
  return { owner: await mk("owner", "Olive Owner"), a: await mk("member", "Ann Member"), b: await mk("member", "Ben Member") };
}

describe("team board", () => {
  it("posts show their author, newest and pinned first, and a missing title falls back to the first line", async () => {
    const { a, b } = await team();
    const p1 = await createPost(a, { body: "# Launch day\nWe shipped the bakery site." });
    expect(p1.title).toBe("Launch day");
    const p2 = await createPost(b, { title: "How we invoice", body: "Send it the same day." });
    await setPinned(a, p1.id, true);
    const feed = await listPosts(a, {});
    expect(feed.map((p) => p.title)).toEqual(["Launch day", "How we invoice"]);
    expect(feed[0].author.displayName).toBe("Ann Member");
    expect(p2.visibility).toBe("team");
  });
  it("private posts are only visible to their author", async () => {
    const { a, b } = await team();
    await createPost(a, { title: "Draft thoughts", body: "just me", visibility: "private" });
    expect(await listPosts(b, {})).toHaveLength(0);
    expect(await listPosts(a, { filter: "private" })).toHaveLength(1);
  });
  it("only the author or an owner can edit, pin or delete; everyone can comment", async () => {
    const { owner, a, b } = await team();
    const post = await createPost(a, { title: "Pricing", body: "Our prices" });
    await expect(saveNote(b, post.id, 1, { title: "Pricing", body: "changed", visibility: "team" })).rejects.toMatchObject({ code: "forbidden" });
    await expect(setPinned(b, post.id, true)).rejects.toMatchObject({ code: "forbidden" });
    await expect(deletePost(b, post.id)).rejects.toMatchObject({ code: "forbidden" });
    const c = await addComment(b, post.id, "Looks right to me");
    expect((await getPostWithComments(a, post.id))!.comments[0].author.displayName).toBe("Ben Member");
    await expect(deleteComment(a, c.id)).rejects.toMatchObject({ code: "forbidden" }); // the post's author can't delete someone else's comment
    await deleteComment(owner, c.id); // an owner can
    await saveNote(owner, post.id, 1, { title: "Pricing", body: "owner edit", visibility: "team" });
    await deletePost(a, post.id);
    expect(await getPostWithComments(a, post.id)).toBeNull();
  });
  it("deleting a post removes its comments and is recorded", async () => {
    const { a, b } = await team();
    const post = await createPost(a, { title: "Temp", body: "x" });
    await addComment(b, post.id, "hi");
    await deletePost(a, post.id);
    expect(await db.noteComment.count({ where: { noteId: post.id } })).toBe(0);
    expect(await db.auditEvent.count({ where: { workspaceId: a.workspaceId, action: "board.post_deleted" } })).toBe(1);
  });
  it("empty comments and posts are refused", async () => {
    const { a } = await team();
    await expect(createPost(a, { body: "   " })).rejects.toThrow();
    const post = await createPost(a, { body: "hello" });
    await expect(addComment(a, post.id, "  ")).rejects.toThrow();
  });
});
