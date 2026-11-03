import { describe, it, expect } from "vitest";
import { db } from "@/lib/db";
import { clientCreateTicket, clientReply, staffReply } from "@/modules/support/service";
import { readUploads, ticketAttachments, clientFile, staffFile } from "@/modules/files/service";
import type { StaffCtx } from "@/modules/identity/session";
import type { ClientCtx } from "@/modules/portal/service";

const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(40)]);
const form = (files: [string, Buffer, string][]) => { const fd = new FormData(); for (const [n, b, t] of files) fd.append("files", new File([new Uint8Array(b)], n, { type: t })); return fd; };

async function world() {
  const w = await db.workspace.create({ data: { name: `f-${Math.random()}` } });
  const m = await db.staffMembership.create({ data: { workspaceId: w.id, email: `s-${Math.random()}@example.test`, displayName: "Abukar", role: "owner", status: "active" } });
  const staff: StaffCtx = { userId: null as unknown as string, staffId: m.id, workspaceId: w.id, role: "owner", name: "Abukar", email: m.email };
  const mk = async (n: string) => { const c = await db.customer.create({ data: { workspaceId: w.id, reference: `OSS-CU-${Math.random().toString(36).slice(2, 8)}`, displayName: n } }); const email = `${n}-${Math.random()}@c.test`.replace(/\s/g, ""); await db.contact.create({ data: { workspaceId: w.id, customerId: c.id, name: n, email, isPrimary: true } }); return { c, client: { userId: `u-${c.id}`, name: n, email, memberships: [{ customerId: c.id, role: "admin", customer: { id: c.id, displayName: n, workspaceId: w.id } }] } as ClientCtx }; };
  return { w, staff, a: await mk("Harbour"), b: await mk("Quay") };
}
const t0 = { kind: "issue", title: "Broken form", body: "It does not send.", urgency: "normal" };

describe("ticket files", () => {
  it("takes the real type from the bytes and rejects anything that is not a picture or PDF", async () => {
    const ok = await readUploads(form([["shot.exe", PNG, "application/x-msdownload"]]));
    expect(ok[0].type).toBe("image/png"); expect(ok[0].name).toBe("shot.png");
    await expect(readUploads(form([["evil.png", Buffer.from("<script>alert(1)</script>"), "image/png"]]))).rejects.toThrow(/isn't a file we can accept/);
    await expect(readUploads(form(Array.from({ length: 5 }, (_, i) => [`${i}.png`, PNG, "image/png"] as [string, Buffer, string])))).rejects.toThrow(/up to 4/);
  });

  it("client files show on their ticket; internal ones are hidden from the customer but open for the team", async () => {
    const { w, staff, a, b } = await world();
    const t = await clientCreateTicket(a.client, undefined, t0, await readUploads(form([["a.png", PNG, "image/png"]])));
    await clientReply(a.client, t.id, "more", await readUploads(form([["b.png", PNG, "image/png"]])));
    await staffReply(staff, t.id, { body: "Looking", internal: false, filesInternal: true }, await readUploads(form([["secret.png", PNG, "image/png"]])));
    await staffReply(staff, t.id, { body: "note", internal: true }, await readUploads(form([["note.png", PNG, "image/png"]])));
    const clientSees = await ticketAttachments(t.id, false), staffSees = await ticketAttachments(t.id, true);
    expect(clientSees.map((f) => f.filename).sort()).toEqual(["a.png", "b.png"]);
    expect(staffSees).toHaveLength(4);
    const secret = staffSees.find((f) => f.filename === "secret.png")!;
    await expect(clientFile(a.client, secret.id)).rejects.toMatchObject({ code: "not_found" });
    expect((await staffFile(w.id, secret.id)).filename).toBe("secret.png");
    const mine = clientSees[0];
    expect((await clientFile(a.client, mine.id)).id).toBe(mine.id);
    await expect(clientFile(b.client, mine.id)).rejects.toMatchObject({ code: "not_found" });
  });
});
