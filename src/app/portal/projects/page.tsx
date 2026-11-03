import Link from "next/link";
import { ArrowRight, FolderKanban } from "lucide-react";
import { requireClient } from "@/modules/identity/session";
import { clientProjects, STAGE_COPY } from "@/modules/portal/service";
import { fmtDate } from "@/components/ui";

export const metadata = { title: "Projects" };
const STEPS = ["Planning", "Design", "Build", "Review", "Live"] as const;
const stepOf = (stage: string) => ({ planned: 0, awaiting_assets: 0, design: 1, development: 2, qa: 2, client_review: 3, ready_to_launch: 3, launched: 4, completed: 4 } as Record<string, number>)[stage] ?? 0;

export default async function PortalProjects() {
  const c = await requireClient();
  const rows = await clientProjects(c);
  return (
    <div className="space-y-4">
      <section className="tile bg-mint !p-7 sm:!p-10"><h1 className="text-4xl sm:text-5xl">Projects</h1><p className="mt-3 max-w-xl text-lg font-medium">Where your website is up to, what we need from you, and the files we've shared.</p></section>
      {rows.length === 0 ? <section className="tile bg-white text-center !py-14"><FolderKanban className="mx-auto mb-3" size={36} aria-hidden /><h2 className="text-2xl">No projects yet</h2><p className="mx-auto mt-2 max-w-md text-muted">Your project appears here once your agreement is signed.</p></section> : rows.map((p) => (
        <Link key={p.id} href={`/projects/${p.id}`} className="tile block bg-white transition-shadow hover:shadow-[0_8px_30px_rgba(14,19,17,.08)]">
          <div className="flex items-start justify-between gap-3"><h2 className="text-2xl">{p.name}</h2><span className="inline-flex items-center gap-1 text-sm font-bold">Open <ArrowRight size={15} aria-hidden /></span></div>
          <ol className="mt-4 grid grid-cols-5 gap-1.5" aria-label="Progress">{STEPS.map((s, i) => <li key={s}><div className={`h-2.5 rounded-full ${i <= stepOf(p.stage) ? "bg-ink" : "bg-bone"}`} /><p className={`mt-1.5 text-xs sm:text-sm ${i === stepOf(p.stage) ? "font-bold" : "text-muted"}`}>{s}</p></li>)}</ol>
          <p className="mt-4 text-[15px]">{STAGE_COPY[p.stage] ?? ""}{p.dueDate ? <span className="text-muted"> Aiming for {fmtDate(p.dueDate)}.</span> : null}</p>
        </Link>
      ))}
    </div>
  );
}
