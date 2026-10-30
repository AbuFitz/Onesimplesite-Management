import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { listTerms, ensureStarterTerms } from "@/modules/settings/service";
import { placeholderCount } from "@/documents/parse";
import { RecordHeader, Status, ErrorSummary, fmtDateTime } from "@/components/ui";

export const metadata = { title: "Terms & Conditions" };
export default async function TermsList({ searchParams }: { searchParams: Promise<{ error?: string; published?: string }> }) {
  const ctx = await requireStaff("settings.write");
  const sp = await searchParams;
  await ensureStarterTerms(ctx);
  const versions = await listTerms(ctx);
  const current = versions.find((v) => v.status === "published");
  return (
    <>
      <RecordHeader title="Terms & Conditions" meta="Versioned. A published version never changes; edits create a new version." />
      <ErrorSummary message={sp.error} />
      {sp.published && <p role="status" className="mb-4 text-sm text-moss">Published. New agreements will use this version.</p>}
      <nav aria-label="Settings sections" className="mb-8 flex gap-2"><Link className="btn btn-quiet" href="/settings">Company details</Link><Link className="btn" href="/settings/terms">Terms &amp; Conditions</Link></nav>
      <p className="mb-4">{current ? <>Current terms: <strong>version {current.number}</strong>, published {current.publishedAt && fmtDateTime(current.publishedAt)} by {current.publishedBy}.</> : <strong>No terms are published yet, so agreements can't be sent.</strong>}</p>
      <ul>
        {versions.map((v) => (
          <li key={v.id} className="row"><Link href={`/settings/terms/${v.id}`} className="flex flex-wrap items-center justify-between gap-2 py-3 min-h-12 hover:bg-wash px-1">
            <span><strong>Version {v.number}</strong> · {v.title}{v.status === "draft" && placeholderCount(v.body) > 0 ? <span className="text-sm text-muted"> · {placeholderCount(v.body)} placeholder(s) to complete</span> : null}</span>
            <Status label={v.status} kind={v.status === "published" ? "good" : v.status === "draft" ? "warn" : "neutral"} />
          </Link></li>
        ))}
      </ul>
    </>
  );
}
