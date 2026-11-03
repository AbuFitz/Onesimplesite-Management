import { getClient } from "@/modules/identity/session";
import { clientFile, fileResponse } from "@/modules/files/service";

/** A customer opening a file on one of their own tickets. Internal files are never served here. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getClient();
  if (!c) return new Response("Please sign in.", { status: 401 });
  const { id } = await params;
  try { return fileResponse(await clientFile(c, id)); } catch { return new Response("Not found", { status: 404 }); }
}
