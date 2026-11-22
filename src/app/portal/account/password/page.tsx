import { requireClient } from "@/modules/identity/session";
import { ChangePasswordForm } from "@/components/password-forms";
export const metadata = { title: "Password" };
export default async function Password() { await requireClient(); return <section className="acc-page"><h1>Password</h1><ChangePasswordForm /></section>; }
