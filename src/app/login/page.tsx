import { headers } from "next/headers";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { origins } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login() {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  return (
    <AuthShell title={portal ? "Client Portal sign in" : "Sign in to Manage"} intro={portal ? "Access is by invitation. Use the details from your invitation email." : "Staff access is by invitation."}>
      <LoginForm staff={!portal} />
      <p className="mt-5 text-sm"><a className="underline" href="/forgot-password">Forgot your password?</a></p>
    </AuthShell>
  );
}
