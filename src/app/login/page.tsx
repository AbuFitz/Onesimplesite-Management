import Image from "next/image";
import { headers } from "next/headers";
import { LoginForm } from "@/components/auth-forms";
import { origins } from "@/lib/env";

export const dynamic = "force-dynamic";
export const metadata = { title: "Sign in" };

export default async function Login() {
  const portal = (await headers()).get("host") === new URL(origins().portal).host;
  return (
    <main className="mx-auto max-w-sm px-4 py-16">
      <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={180} height={36} priority />
      <h1 className="mt-8 mb-6 text-[22px]">{portal ? "Client Portal" : "Manage"} sign in</h1>
      <LoginForm />
      <p className="hint mt-6">{portal ? "Access is by invitation. Contact your OneSimpleSite project owner if you need help." : "Staff access is invite-only."}</p>
    </main>
  );
}
