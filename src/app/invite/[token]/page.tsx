import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { InviteForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { acceptExistingInvitation } from "@/app/actions/auth";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accept invitation" };

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  const ok = inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  if (!ok) {
    return (
      <AuthShell title="This invitation can't be used" intro="It may have expired or already been used. Ask the person who invited you to send a new one." footer={<>Already set up? <a className="underline" href="/login">Sign in</a></>}>
        <span />
      </AuthShell>
    );
  }
  if (inv.kind === "client" && inv.customerId && (await db.user.findFirst({ where: { email: { equals: inv.email, mode: "insensitive" } }, select: { id: true } }))) {
    const cu = await db.customer.findUnique({ where: { id: inv.customerId }, select: { displayName: true } });
    return (
      <AuthShell title="You already have a login" intro={`${inv.email} is already set up with us. Add ${cu?.displayName ?? "this company"} to it. Your password stays exactly as it is.`}>
        <form action={acceptExistingInvitation} className="space-y-3"><input type="hidden" name="token" value={token} /><button className="btn w-full">Add {cu?.displayName ?? "this company"} to my login</button><p className="hint text-center">Then sign in with the password you already use.</p></form>
      </AuthShell>
    );
  }
  const m = inv.kind === "staff" ? await db.staffMembership.findFirst({ where: { workspaceId: inv.workspaceId, email: inv.email }, select: { displayName: true, username: true } }) : null;
  return (
    <AuthShell title="Set up your login" intro="Choose a password to finish creating your account.">
      <InviteForm token={token} email={inv.email} staff={m ? { name: m.displayName, username: m.username } : undefined} />
    </AuthShell>
  );
}
