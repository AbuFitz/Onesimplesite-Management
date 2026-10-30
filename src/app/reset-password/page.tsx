import { ResetForm } from "@/components/password-forms";
import { AuthShell } from "@/components/auth-shell";
export const metadata = { title: "Set a new password" };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  if (!token || error) {
    return (
      <AuthShell title="This link has expired" intro="Reset links work once and last an hour, so this one can't be used any more.">
        <a className="btn" href="/forgot-password">Send me a new link</a>
      </AuthShell>
    );
  }
  return <AuthShell title="Choose a new password" intro="Pick something you don't use anywhere else."><ResetForm token={token} /></AuthShell>;
}
