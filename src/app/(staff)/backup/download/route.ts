import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { buildBackup } from "@/modules/export/service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET() {
  const ctx = await getStaff();
  if (!ctx || !can(ctx.role, "data.export")) return new Response("Unauthorised", { status: 401 });
  const { data } = await buildBackup(ctx);
  const day = new Date().toISOString().slice(0, 10);
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="onesimplesite-backup-${day}.json"`, "Cache-Control": "no-store" },
  });
}
