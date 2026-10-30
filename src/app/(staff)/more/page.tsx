import Link from "next/link";
import { requireStaff, } from "@/modules/identity/session";
import { signOutStaff } from "@/app/actions/auth";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "More" };
export default async function More() {
  await requireStaff();
  const items = [["/pipeline", "Deals"], ["/proposals", "Quotes"], ["/contracts", "Agreements"], ["/notes", "Notes"], ["/projects", "Projects"], ["/account", "My account"]];
  return (
    <>
      <RecordHeader title="More" />
      <ul>{items.map(([h, l]) => <li key={h} className="row"><Link href={h} className="flex min-h-12 items-center">{l}</Link></li>)}</ul>
      <form action={signOutStaff} className="mt-8"><button className="btn btn-quiet">Sign out</button></form>
    </>
  );
}
