import { requireClient } from "@/modules/identity/session";
import { MyDetailsForm } from "@/components/my-details-form";
import { db } from "@/lib/db";
export const metadata = { title: "Your details" };
export default async function Details() {
  const c = await requireClient();
  const me = c.email ? await db.contact.findFirst({ where: { customerId: { in: c.memberships.map((m) => m.customerId) }, email: { equals: c.email, mode: "insensitive" } }, select: { phone: true, position: true } }) : null;
  return <section className="acc-page"><h1>Your details</h1><p className="mb-4 text-sm text-muted">Keep these right so we know who we&apos;re talking to.</p><MyDetailsForm name={c.name ?? ""} email={c.email ?? ""} phone={me?.phone ?? ""} position={me?.position ?? ""} /></section>;
}
