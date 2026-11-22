import type { ReactNode } from "react";
import { requireStaff } from "@/modules/identity/session";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { db } from "@/lib/db";
import { AccountFrame } from "@/components/account-nav";
import { accountItems } from "./items";

export default async function AccountLayout({ children }: { children: ReactNode }) {
  const ctx = await requireStaff();
  const [me, twoFactor] = await Promise.all([getMyProfile(ctx), db.twoFactor.count({ where: { userId: ctx.userId, verified: true } })]);
  const missing = profileMissing(me);
  return <AccountFrame base="/account" title="My account" items={accountItems({ twoStep: twoFactor > 0, profileNote: missing.length ? "Needs a look" : undefined })}>{children}</AccountFrame>;
}
