import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { requireStaff } from "@/modules/identity/session";
import { createProposalAction } from "@/app/actions/crm";
import { RecordHeader, ErrorSummary } from "@/components/ui";
import { ProposalFields } from "@/components/proposal-fields";

export const metadata = { title: "New proposal" };
export default async function NewProposal({ searchParams }: { searchParams: Promise<{ customer?: string; error?: string }> }) {
  const ctx = await requireStaff("proposal.write");
  const sp = await searchParams;
  const c = sp.customer ? await db.customer.findFirst({ where: { id: sp.customer, workspaceId: ctx.workspaceId }, include: { opportunities: { where: { stage: { notIn: ["won", "lost"] } }, take: 1 } } }) : null;
  if (!c) notFound();
  return (
    <>
      <RecordHeader back={{ href: `/customers/${c.id}`, label: c.displayName }} title="New proposal" />
      <ErrorSummary message={sp.error} />
      <form action={createProposalAction} className="max-w-2xl space-y-4">
        <input type="hidden" name="customerId" value={c.id} /><input type="hidden" name="opportunityId" value={c.opportunities[0]?.id ?? ""} />
        <ProposalFields />
        <button className="btn">Save draft</button>
      </form>
    </>
  );
}
