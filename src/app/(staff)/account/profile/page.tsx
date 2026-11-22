import { requireStaff } from "@/modules/identity/session";
import { getMyProfile } from "@/modules/identity/profile";
import { ProfileForm } from "@/components/profile-forms";
export const metadata = { title: "Profile" };
export default async function Profile() {
  const ctx = await requireStaff(); const me = await getMyProfile(ctx);
  return <section className="acc-page"><h1>Profile and signature</h1><ProfileForm email={me.email} initial={{ name: me.displayName, jobTitle: me.jobTitle ?? "", phone: me.phone ?? "", signature: me.signature ?? "" }} /></section>;
}
