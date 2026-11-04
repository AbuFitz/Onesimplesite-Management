import { headers } from "next/headers";
import { LoginForm } from "@/components/auth-forms";
import { AuthShell } from "@/components/auth-shell";
import { origins } from "@/lib/env";
import { ErrorSummary } from "@/components/ui";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login({ searchParams }: { searchParams: Promise<{ added?: string; error?: string }> }) {
  const sp = await searchParams;
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  return (
    <AuthShell title={portal ? "Welcome back" : "Sign in"} intro={portal ? "Sign in to see your projects, documents and payments. Your invitation email has your details." : undefined}>
      {sp.added && <p role="status" className="mb-4 rounded-lg bg-[#e9f6ef] px-4 py-3 text-sm font-semibold text-[#0a5a3d]">Done. Sign in with the password you already use.</p>}
      <ErrorSummary message={sp.error} />
      <LoginForm staff={!portal} />
      <p className="mt-5 text-sm"><a className="underline" href="/forgot-password">Forgot your password?</a></p>
    </AuthShell>
  );
}
