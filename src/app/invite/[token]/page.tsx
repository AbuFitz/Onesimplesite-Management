import { db } from "@/lib/db";
import { sha256 } from "@/lib/tokens";
import { InviteForm } from "@/components/auth-forms";

export const dynamic = "force-dynamic";
export const metadata = { title: "Accept invitation" };

export default async function Invite({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const inv = await db.invitation.findUnique({ where: { tokenHash: sha256(token) } });
  const ok = inv && !inv.acceptedAt && !inv.revokedAt && inv.expiresAt > new Date();
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-[22px]">Accept invitation</h1>
      {ok ? <InviteForm token={token} email={inv.email} /> : (
        <p role="alert">This invitation has expired or was already used. Ask the person who invited you to send a new one.</p>
      )}
    </main>
  );
}
