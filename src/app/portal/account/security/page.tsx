import { requireClient } from "@/modules/identity/session";
import { SecurityPanel } from "@/components/security-panel";
import { db } from "@/lib/db";
export const metadata = { title: "Two-step sign-in" };
export default async function Security() {
  const c = await requireClient();
  const has = !!(await db.twoFactor.count({ where: { userId: c.userId, verified: true } }));
  return <section className="acc-page"><h1>Two-step sign-in</h1><p className="mb-4 text-sm text-muted">Optional extras that make your account safer.</p><SecurityPanel ns="portal" hasAuthenticator={has} /></section>;
}
