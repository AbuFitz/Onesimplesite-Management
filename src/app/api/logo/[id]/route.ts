import { getStaff } from "@/modules/identity/session";
import { companyLogo } from "@/modules/identity/photo";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s) return new Response("Please sign in.", { status: 401 });
  const l = await companyLogo((await params).id, s.workspaceId);
  if (!l) return new Response("None", { status: 404 });
  return new Response(new Uint8Array(l.bytes), { headers: { "Content-Type": l.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=30, must-revalidate" } });
}
