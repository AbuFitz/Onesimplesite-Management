import { getStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Companies that look like the one being added: same name (or part of it), same company number, or a contact with the same email. */
export async function GET(req: Request) {
  const ctx = await getStaff();
  if (!ctx) return new Response("Please sign in.", { status: 401 });
  const u = new URL(req.url);
  const name = (u.searchParams.get("name") ?? "").trim(), number = (u.searchParams.get("number") ?? "").replace(/\s+/g, ""), email = (u.searchParams.get("email") ?? "").trim().toLowerCase();
  const or = [
    ...(name.length >= 3 ? [{ displayName: { contains: name, mode: "insensitive" as const } }, { legalName: { contains: name, mode: "insensitive" as const } }] : []),
    ...(number.length >= 5 ? [{ companyNumber: number }] : []),
    ...(email.includes("@") ? [{ contacts: { some: { email: { equals: email, mode: "insensitive" as const } } } }] : []),
  ];
  if (!or.length) return Response.json({ matches: [] });
  const rows = await db.customer.findMany({ where: { workspaceId: ctx.workspaceId, OR: or }, select: { id: true, displayName: true, reference: true, companyNumber: true, archivedAt: true, ...(email.includes("@") ? { contacts: { where: { email: { equals: email, mode: "insensitive" as const } }, select: { id: true }, take: 1 } } : {}) }, take: 5, orderBy: { displayName: "asc" } });
  return Response.json({ matches: rows.map((r) => ({ id: r.id, name: r.displayName, ref: r.reference, archived: !!r.archivedAt, why: number && r.companyNumber === number ? "Same company number" : ("contacts" in r && (r.contacts as unknown[]).length) ? "A contact there has the same email" : "Similar name" })) });
}
