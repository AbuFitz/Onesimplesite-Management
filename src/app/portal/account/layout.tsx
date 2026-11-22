import type { ReactNode } from "react";
import { requireClient } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { AccountFrame } from "@/components/account-nav";
import { portalItems } from "./items";

export default async function PortalAccountLayout({ children }: { children: ReactNode }) {
  const c = await requireClient();
  const t = await db.twoFactor.count({ where: { userId: c.userId, verified: true } });
  return <AccountFrame base="/account" title="Settings" items={portalItems({ twoStep: t > 0, companies: c.memberships.length })}>{children}</AccountFrame>;
}
