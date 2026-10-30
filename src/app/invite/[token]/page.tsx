import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { InviteForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";

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
  return <AuthShell title="Set up your login" intro="Choose a password to finish creating your account."><InviteForm token={token} email={inv.email} /></AuthShell>;
}
