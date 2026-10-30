import { requireStaff } from "@/modules/identity/session";
import { ROLE_INFO } from "@/modules/identity/permissions";
import { ChangePasswordForm } from "@/components/password-forms";
import { RecordHeader } from "@/components/ui";

export const metadata = { title: "My account" };
export default async function Account() {
  const ctx = await requireStaff();
  return (
    <>
      <RecordHeader title="My account" meta={`${ctx.email} · ${ROLE_INFO[ctx.role].label}`} />
      <section aria-labelledby="pw"><h2 id="pw" className="mb-3">Change password</h2><ChangePasswordForm /></section>
    </>
  );
}
