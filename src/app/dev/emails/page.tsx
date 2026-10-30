import Link from "next/link";
import { notFound } from "next/navigation";
export default function Gallery() {
  if (process.env.APP_ENV !== "development") notFound();
  return (<main className="p-6"><h1 className="mb-4">Email previews (development only)</h1><ul>{["proposal", "contract_request", "signing_confirmation", "signing_notice", "invitation", "password_reset", "password_changed", "staff_invitation"].map((n) => <li key={n} className="row"><Link className="block py-3 underline" href={`/dev/emails/${n}`}>{n}</Link></li>)}</ul></main>);
}
