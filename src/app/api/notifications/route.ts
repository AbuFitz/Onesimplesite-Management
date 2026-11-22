import { getClient, getStaff } from "@/modules/identity/session";
import { clientNotices, staffNotices } from "@/modules/notifications/feed";

export const dynamic = "force-dynamic";
/** The bell's feed for whoever is signed in on this site (team on the manage site, customers on the portal). */
export async function GET() {
  const staff = await getStaff();
  if (staff) return Response.json({ who: `s:${staff.userId}`, notices: await staffNotices(staff) });
  const client = await getClient();
  if (client) return Response.json({ who: `c:${client.userId}`, notices: await clientNotices(client) });
  return new Response("Please sign in.", { status: 401 });
}
