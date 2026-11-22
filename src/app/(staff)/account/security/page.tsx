import { requireStaff } from "@/modules/identity/session";
import { SecurityPanel } from "@/components/security-panel";
import { db } from "@/lib/db";
export const metadata = { title: "Two-step sign-in" };
export default async function Security() {
  const ctx = await requireStaff();
  const hasTotp = !!(await db.twoFactor.count({ where: { userId: ctx.userId, verified: true } }));
  return <section className="acc-page"><h1>Two-step sign-in</h1><SecurityPanel ns="staff" hasAuthenticator={hasTotp} /></section>;
}
