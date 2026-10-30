import Image from "next/image";
import { ForgotForm } from "@/components/password-forms";
export const metadata = { title: "Forgot password" };
export default function Forgot() {
  return (<main className="mx-auto max-w-sm px-4 py-16"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={180} height={36} /><h1 className="mt-8 mb-6 text-[22px]">Forgot your password?</h1><ForgotForm /></main>);
}
