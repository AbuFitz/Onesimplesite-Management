import { getClient } from "@/modules/identity/session";
import { clientPhotoForClient } from "@/modules/identity/photo";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getClient();
  if (!c) return new Response("Please sign in.", { status: 401 });
  const p = await clientPhotoForClient((await params).id, c.userId, c.memberships.map((m) => m.customerId));
  if (!p) return new Response("None", { status: 404 });
  return new Response(new Uint8Array(p.bytes), { headers: { "Content-Type": p.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=30, must-revalidate" } });
}
