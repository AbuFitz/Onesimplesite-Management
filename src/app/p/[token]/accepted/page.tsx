import Image from "next/image";
export const metadata = { title: "Proposal accepted" };
export default function Accepted() {
  return (
    <main className="mx-auto max-w-xl px-4 py-16">
      <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={160} height={32} />
      <h1 className="mt-8 text-[22px]">Thank you, your acceptance is recorded</h1>
      <p className="mt-2 text-muted">We will prepare the contract and contact you with the next step. Accepting a proposal is not the same as signing the contract.</p>
    </main>
  );
}
