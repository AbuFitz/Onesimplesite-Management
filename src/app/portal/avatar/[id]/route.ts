import { getClient } from "@/modules/identity/session";
import { staffPhoto } from "@/modules/identity/photo";

/** Clients see the picture of the team member who replied to them. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getClient();
  if (!c) return new Response("Please sign in.", { status: 401 });
  const p = await staffPhoto((await params).id, c.memberships[0]?.customer.workspaceId);
  if (!p) return new Response("None", { status: 404 });
  return new Response(new Uint8Array(p.bytes), { headers: { "Content-Type": p.type, "X-Content-Type-Options": "nosniff", "Cache-Control": "private, max-age=30, must-revalidate" } });
}
