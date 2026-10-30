import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { clientProjects, STAGE_COPY } from "@/modules/portal/service";
import { Empty } from "@/components/ui";

export const metadata = { title: "Projects" };
export default async function PortalProjects() {
  const c = await requireClient();
  const rows = await clientProjects(c);
  return (<><h1 className="mb-4">Projects</h1>{rows.length === 0 ? <Empty title="No projects yet" /> : <ul>{rows.map((p) => <li key={p.id} className="row"><Link className="block py-3 min-h-12" href={`/projects/${p.id}`}><strong>{p.name}</strong><span className="block text-sm text-muted">{STAGE_COPY[p.stage]}</span></Link></li>)}</ul>}</>);
}
