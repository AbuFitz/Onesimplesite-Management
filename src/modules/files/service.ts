import { db, type Tx } from "@/lib/db";
import { DomainError, notFound } from "@/lib/errors";
import type { ClientCtx } from "@/modules/portal/service";

/** Keep each submission under the 4.5 MB request limit of the host. Photos are shrunk in the browser first. */
export const MAX_FILES = 4;
export const MAX_TOTAL_BYTES = 4_000_000;

export type Upload = { name: string; type: string; bytes: Buffer };

const textLike = (b: Buffer) => { const n = Math.min(b.length, 4000); if (!n) return false; let bad = 0; for (let i = 0; i < n; i++) { const c = b[i]; if (c === 0 || (c < 9) || (c > 13 && c < 32)) bad++; } return bad === 0; };
const sniff = (b: Buffer, extra = false): { type: string; ext: string } | null => {
  if (b.length > 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return { type: "image/png", ext: "png" };
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return { type: "image/jpeg", ext: "jpg" };
  if (b.length > 6 && b.subarray(0, 4).toString("latin1") === "GIF8") return { type: "image/gif", ext: "gif" };
  if (b.length > 12 && b.subarray(0, 4).toString("latin1") === "RIFF" && b.subarray(8, 12).toString("latin1") === "WEBP") return { type: "image/webp", ext: "webp" };
  if (b.length > 5 && b.subarray(0, 5).toString("latin1") === "%PDF-") return { type: "application/pdf", ext: "pdf" };
  if (extra) {
    if (b.length > 4 && b[0] === 0x50 && b[1] === 0x4b && b[2] === 0x03 && b[3] === 0x04) return { type: "application/zip", ext: "zip" };   // zip, and Word / Excel / PowerPoint files
    if (b.length > 0 && textLike(b) && !/^\s*</.test(b.subarray(0, 64).toString("latin1"))) return { type: "text/plain", ext: "txt" };                // plain notes, CSV. Anything that looks like HTML is refused
  }
  return null;
};
const safeKeep = (n: string, fallback: string) => { const clean = n.replace(/[^\w.\- ()]+/g, "_").replace(/\.+/g, ".").slice(0, 80); return /\.(docx?|xlsx?|pptx?|zip|txt|csv|md)$/i.test(clean) ? clean : `${clean.replace(/\.\w{1,5}$/, "") || "file"}.${fallback}`; };
export const isImage = (t: string) => t.startsWith("image/");
const safeName = (n: string, ext: string) => (n.replace(/[^\w.\- ()]+/g, "_").replace(/\.+/g, ".").slice(0, 80) || "file").replace(/\.[A-Za-z0-9]{1,5}$/, "") + "." + ext;

/** Reads uploads from a form. The file's real type is taken from its bytes, never from what the browser claims. */
export async function readUploads(fd: FormData, field = "files", o: { extra?: boolean } = {}): Promise<Upload[]> {
  const files = fd.getAll(field).filter((f): f is File => typeof f !== "string" && f.size > 0);
  if (files.length > MAX_FILES) throw new DomainError("validation", `You can add up to ${MAX_FILES} files at a time.`);
  const out: Upload[] = [];
  let total = 0;
  for (const f of files) {
    total += f.size;
    if (total > MAX_TOTAL_BYTES) throw new DomainError("validation", "Those files are too big together. Keep it under 4 MB, or send fewer.");
    const bytes = Buffer.from(await f.arrayBuffer());
    const kind = sniff(bytes, o.extra);
    if (!kind) throw new DomainError("validation", `“${f.name}” isn't a file we can accept. ${o.extra ? "Use a picture, PDF, Word or Excel file, zip or plain text." : "We accept PNG, JPG, GIF, WebP and PDF."}`);
    out.push({ name: kind.type === "application/zip" || kind.type === "text/plain" ? safeKeep(f.name, kind.ext) : safeName(f.name, kind.ext), type: kind.type, bytes });
  }
  return out;
}

export async function saveUploads(tx: Tx, o: { workspaceId: string; customerId: string; ticketId?: string | null; projectId?: string | null; folder?: string | null; commentId?: string | null; internal: boolean; by: "staff" | "client"; name: string }, files: Upload[]) {
  for (const f of files) await tx.attachment.create({ data: { workspaceId: o.workspaceId, customerId: o.customerId, ticketId: o.ticketId ?? null, projectId: o.projectId ?? null, folder: o.folder ?? null, commentId: o.commentId ?? null, filename: f.name, contentType: f.type, sizeBytes: f.bytes.length, bytes: new Uint8Array(f.bytes), internal: o.internal, uploadedBy: o.by, uploadedName: o.name } });
}

const meta = { id: true, filename: true, contentType: true, sizeBytes: true, commentId: true, internal: true, uploadedBy: true, folder: true, createdAt: true, uploadedName: true } as const;
export type AttachmentMeta = { id: string; filename: string; contentType: string; sizeBytes: number; commentId: string | null; internal: boolean; uploadedBy: string; folder: string | null; createdAt: Date; uploadedName: string };

/** Files on a project. The team sees all; the customer only sees the ones shared with them. */
export const projectFileList = (projectId: string, includeInternal: boolean): Promise<AttachmentMeta[]> =>
  db.attachment.findMany({ where: { projectId, ...(includeInternal ? {} : { internal: false }) }, orderBy: [{ folder: "asc" }, { createdAt: "desc" }], select: meta });

export const ticketAttachments = (ticketId: string, includeInternal: boolean): Promise<AttachmentMeta[]> =>
  db.attachment.findMany({ where: { ticketId, ...(includeInternal ? {} : { internal: false }) }, orderBy: { createdAt: "asc" }, select: meta });

/** The team can open anything in their workspace. */
export async function staffFile(workspaceId: string, id: string) {
  const a = await db.attachment.findFirst({ where: { id, workspaceId } });
  if (!a) throw notFound();
  return a;
}
/** Customers can only open files on their own tickets that the team hasn't marked internal. */
export async function clientFile(c: ClientCtx, id: string) {
  const a = await db.attachment.findFirst({ where: { id, internal: false, customerId: { in: c.memberships.map((m) => m.customerId) } } });
  if (!a) throw notFound();
  return a;
}

export function fileResponse(a: { bytes: Uint8Array; contentType: string; filename: string }) {
  const inline = isImage(a.contentType);
  return new Response(new Uint8Array(a.bytes), { headers: { "Content-Type": a.contentType, "Content-Disposition": `${inline ? "inline" : "attachment"}; filename="${a.filename.replace(/"/g, "")}"`, "X-Content-Type-Options": "nosniff", "Content-Security-Policy": "default-src 'none'; img-src 'self' data:; sandbox", "Cache-Control": "private, no-store" } });
}
