import { getStaff } from "@/modules/identity/session";
import { searchAll } from "@/modules/search/service";

export const dynamic = "force-dynamic";
/** Powers the ⌘K search. Same permission-aware search as the Search page. */
export async function GET(req: Request) {
  const ctx = await getStaff();
  if (!ctx) return new Response("Please sign in.", { status: 401 });
  const q = new URL(req.url).searchParams.get("q") ?? "";
  return Response.json(await searchAll(ctx, q));
}
