import Link from "next/link";
import { requireClient } from "@/modules/identity/session";
import { activeAccount, clientProjects, STAGE_COPY } from "@/modules/portal/service";
import { Empty } from "@/components/ui";

export const metadata = { title: "Overview" };
export default async function PortalOverview() {
  const c = await requireClient();
  const a = activeAccount(c);
  const projects = await clientProjects(c);
  const current = projects.find((p) => !["completed", "cancelled"].includes(p.stage));
  return (
    <>
      <h1 className="mb-6">Hello, {a.customer.displayName}</h1>
      {current ? (
        <section aria-labelledby="cur"><h2 id="cur" className="mb-1">{current.name}</h2><p>{STAGE_COPY[current.stage]}</p><Link className="btn mt-3" href={`/projects/${current.id}`}>Open project</Link></section>
      ) : <Empty title="No active project right now">Contact us from the Help page if you need anything.</Empty>}
    </>
  );
}
