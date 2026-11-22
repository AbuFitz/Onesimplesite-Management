import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
export const metadata = { title: "Privacy and legal" };
export default async function Legal() {
  await requireClient();
  return <section className="acc-page"><h1>Privacy and legal</h1><ul className="set-rows">{[["/legal/privacy", "Privacy notice"], ["/legal/cookies", "Cookie notice"], ["/legal/terms", "Terms of use"]].map(([h, l]) => <li key={h}><Link href={h} className="set-row"><span className="set-txt"><b>{l}</b></span></Link></li>)}</ul></section>;
}
