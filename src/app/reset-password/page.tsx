import Image from "next/image";
import { ResetForm } from "@/components/password-forms";
export const metadata = { title: "Set a new password" };
export default async function Reset({ searchParams }: { searchParams: Promise<{ token?: string; error?: string }> }) {
  const { token, error } = await searchParams;
  return (
    <main className="mx-auto max-w-sm px-4 py-16"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={180} height={36} />
      <h1 className="mt-8 mb-6 text-[22px]">Set a new password</h1>
      {token && !error ? <ResetForm token={token} /> : <p role="alert">This reset link is invalid or has expired. <a className="underline" href="/forgot-password">Request a new one</a>.</p>}
    </main>);
}
