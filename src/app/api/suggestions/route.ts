import { getStaff } from "@/modules/identity/session";
import { suggestionsFor } from "@/modules/smart/service";

export const dynamic = "force-dynamic";
export async function GET() {
  const ctx = await getStaff();
  if (!ctx) return new Response("Please sign in.", { status: 401 });
  return Response.json({ suggestions: await suggestionsFor(ctx) });
}
