import { getStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { receiptFor, buildReceiptPdf, companyForReceipt } from "@/modules/billing/receipt";
import { db } from "@/lib/db";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const s = await getStaff();
  if (!s || !can(s.role, "customer.read")) return new Response("Please sign in.", { status: 401 });
  try {
    const r = await receiptFor({ id: (await params).id, workspaceId: s.workspaceId });
    const cu = await db.customer.findUniqueOrThrow({ where: { id: r.customerId }, select: { displayName: true, billingAddress: true } });
    const pdf = await buildReceiptPdf(r, { business: cu.displayName, billingAddress: cu.billingAddress }, await companyForReceipt(r.workspaceId));
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `inline; filename="${r.ref}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
