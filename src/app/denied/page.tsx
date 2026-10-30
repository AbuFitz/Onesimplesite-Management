import Link from "next/link";
export const metadata = { title: "No access" };
export default function Denied() {
  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <h1 className="text-[22px] mb-2">You don’t have access to this</h1>
      <p className="text-muted mb-4">Your role doesn’t include this action. Ask the owner if you think it should.</p>
      <Link className="btn" href="/">Back to Today</Link>
    </main>
  );
}
