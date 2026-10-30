import { requireClient } from "@/modules/identity/session";
export const metadata = { title: "Account" };
export default async function Account() {
  const c = await requireClient();
  return (<><h1 className="mb-4">Account</h1><p>Signed in as {c.name}.</p><h2 className="mt-6 mb-2">Businesses you can access</h2><ul>{c.memberships.map((m) => <li key={m.customerId} className="row py-2">{m.customer.displayName} <span className="text-muted text-sm">({m.role})</span></li>)}</ul></>);
}
