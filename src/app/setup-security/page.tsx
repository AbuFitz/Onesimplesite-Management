import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getStaff, getStaffNeedingSetup, getClient, getClientNeedingSetup } from "@/modules/identity/session";
import { SetupWizard } from "@/components/setup-wizard";
import { AuthShell } from "@/components/auth-shell";
import { origins } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Protect your account" };

/** Where someone is sent right after their password when two-step sign-in is required and not yet set up. */
export default async function SetupSecurity() {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  const pending = portal ? await getClientNeedingSetup() : await getStaffNeedingSetup();
  if (!pending) {
    const done = portal ? await getClient() : await getStaff();
    redirect(done ? (portal ? "/overview" : "/") : "/login");
  }
  return (
    <AuthShell title="Protect your account" intro="One quick step to keep your account safe.">
      <SetupWizard ns={portal ? "portal" : "staff"} name={pending.name ?? ""} />
    </AuthShell>
  );
}
