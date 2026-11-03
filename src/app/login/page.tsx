import { headers } from "next/headers";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { origins } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login() {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  return (
    <AuthShell title={portal ? "Welcome back" : "Sign in"} intro={portal ? "Sign in to see your projects, documents and payments. Your invitation email has your details." : undefined}>
      <LoginForm staff={!portal} />
      <p className="mt-5 text-sm"><a className="underline" href="/forgot-password">Forgot your password?</a></p>
    </AuthShell>
  );
}
