import Link from "next/link";
import { notFound } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { listTerms, ensureStarter } from "@/modules/settings/service";
import { isLegalKind, LEGAL } from "@/modules/settings/legal-docs";
import { placeholderCount } from "@/documents/parse";
import { RecordHeader, Status, ErrorSummary, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Legal document" };
export default async function VersionList({ params, searchParams }: { params: Promise<{ kind: string }>; searchParams: Promise<{ error?: string; published?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const { kind } = await params;
  if (!isLegalKind(kind)) notFound();
  const sp = await searchParams;
  await ensureStarter(ctx, kind);
  const versions = await listTerms(ctx, kind);
  const current = versions.find((v) => v.status === "published");
  const m = LEGAL[kind];
  return (
    <>
      <RecordHeader back={{ href: "/settings/legal", label: "Legal documents" }} title={m.label} meta={`${m.ref} · versioned. A published version never changes; edits create a new version.`} />
      <ErrorSummary message={sp.error} />
      {sp.published && <p role="status" className="mb-4 text-sm text-moss">Published.{kind === "terms" ? " New agreements will use this version." : ""}</p>}
      <p className="mb-4">{current ? <>Live: <strong>version {current.number}</strong>, published {current.publishedAt && fmtDateTime(current.publishedAt)} by {current.publishedBy}.</> : <strong>Nothing is published yet.{kind === "terms" ? " Agreements can't be sent until the Terms and Conditions are published." : ""}</strong>}</p>
      <ul>
        {versions.map((v) => (
          <li key={v.id} className="row"><Link href={`/settings/legal/${kind}/${v.id}`} className="flex min-h-12 flex-wrap items-center justify-between gap-2 px-1 py-3 hover:bg-soft">
            <span><strong>Version {v.number}</strong> · {v.title}{v.status === "draft" && placeholderCount(v.body) > 0 ? <span className="text-sm text-muted"> · {placeholderCount(v.body)} to decide</span> : null}</span>
            <Status label={v.status} kind={v.status === "published" ? "good" : v.status === "draft" ? "warn" : "neutral"} />
          </Link></li>
        ))}
      </ul>
    </>
  );
}
