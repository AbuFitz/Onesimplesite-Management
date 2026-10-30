import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { clientProjects, STAGE_COPY } from "@/modules/portal/service";
import { Empty, Status } from "@/components/ui";

export const metadata = { title: "Projects" };
export default async function PortalProjects() {
  const c = await requireClient();
  const rows = await clientProjects(c);
  return (<><h1 className="mb-6">Projects</h1>{rows.length === 0 ? <Empty title="No projects yet">Your project appears here once your agreement is signed.</Empty> : <ul>{rows.map((p) => <li key={p.id} className="row"><Link className="flex min-h-16 items-center justify-between gap-3 py-3 hover:bg-soft sm:-mx-3 sm:rounded-lg sm:px-3" href={`/projects/${p.id}`}><span className="min-w-0"><span className="font-medium">{p.name}</span><span className="block text-sm text-muted">{STAGE_COPY[p.stage]}</span></span><Status label={p.stage} /></Link></li>)}</ul>}</>);
}
