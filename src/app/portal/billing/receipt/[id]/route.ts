import { getClient } from "@/modules/identity/session";
import { receiptFor, buildReceiptPdf, companyForReceipt } from "@/modules/billing/receipt";
import { db } from "@/lib/db";

/** A customer downloading their own receipt. Only people with billing access to that business can. */
export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const c = await getClient();
  if (!c) return new Response("Please sign in.", { status: 401 });
  try {
    const r = await receiptFor({ id: (await params).id, client: c });
    const cu = await db.customer.findUniqueOrThrow({ where: { id: r.customerId }, select: { displayName: true, billingAddress: true } });
    const pdf = await buildReceiptPdf(r, { business: cu.displayName, billingAddress: cu.billingAddress }, await companyForReceipt(r.workspaceId));
    return new Response(new Uint8Array(pdf), { headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="${r.ref}.pdf"`, "Cache-Control": "private, no-store" } });
  } catch { return new Response("Not found", { status: 404 }); }
}
