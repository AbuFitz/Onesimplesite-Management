import { requireStaff } from "@/modules/identity/session";
import { getMyProfile } from "@/modules/identity/profile";
import { ChangeEmailForm } from "@/components/profile-forms";
export const metadata = { title: "Sign-in email" };
export default async function Email() {
  const ctx = await requireStaff(); const me = await getMyProfile(ctx);
  return <section className="acc-page"><h1>Sign-in email</h1><ChangeEmailForm email={me.email} /></section>;
}
