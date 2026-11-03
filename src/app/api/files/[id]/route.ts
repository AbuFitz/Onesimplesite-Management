import { getStaff } from "@/modules/identity/session";
import { staffFile, fileResponse } from "@/modules/files/service";

/** The team opening any ticket file, internal or not. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s) return new Response("Please sign in.", { status: 401 });
  const { id } = await params;
  try { return fileResponse(await staffFile(s.workspaceId, id)); } catch { return new Response("Not found", { status: 404 }); }
}
