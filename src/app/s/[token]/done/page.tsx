import Image from "next/image";
export const metadata = { title: "Signed", robots: { index: false } };
export default function Done() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={160} height={32} />
      <h1 className="mt-8 text-[22px]">Thank you, your signature is recorded</h1>
      <p className="mt-2">We have emailed you a confirmation with a copy of the signed agreement. Your project owner will be in touch about next steps.</p>
    </main>
  );
}
