import { redirect } from "next/navigation";

/** Old address. Creating a quote now happens in the New ticket popup. */
export default async function NewProposal({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  redirect(customer ? `/tickets/new?business=${customer}` : "/tickets/new");
}
