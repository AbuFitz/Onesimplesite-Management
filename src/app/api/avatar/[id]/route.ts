import { getStaff } from "@/modules/identity/session";
import { staffPhoto } from "@/modules/identity/photo";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s) return new Response("Please sign in.", { status: 401 });
  const p = await staffPhoto((await params).id, s.workspaceId);
  if (!p) return new Response("None", { status: 404 });
  return new Response(new Uint8Array(p.bytes), { headers: { "Content-Type": p.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=30, must-revalidate" } });
}
