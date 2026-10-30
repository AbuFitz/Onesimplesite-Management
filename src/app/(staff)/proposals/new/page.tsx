import { redirect } from "next/navigation";

/** Old address. Creating a quote now happens in the New job popup. */
export default async function NewProposal({ searchParams }: { searchParams: Promise<{ customer?: string }> }) {
  const { customer } = await searchParams;
  redirect(customer ? `/customers/${customer}?new=job&customer=${customer}` : "/?new=job");
}
