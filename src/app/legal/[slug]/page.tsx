import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { kindFromSlug, LEGAL } from "@/modules/settings/legal-docs";
import { splitIntro } from "@/modules/settings/legal-starters";
import { AgreementText } from "@/components/agreement";
import { LegalSheet } from "@/components/legal-sheet";

export const dynamic = "force-dynamic";

/** The live version of a public legal page. Drafts are never shown here. */
async function load(slug: string) {
  const kind = kindFromSlug(slug);
  if (!kind) return null;
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  if (!w) return null;
  const doc = await db.termsVersion.findFirst({ where: { workspaceId: w.id, kind, status: "published" } });
  return doc ? { kind, doc } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const r = await load((await params).slug);
  return { title: r ? `${r.doc.title} · OneSimpleSite` : "Not found" };
}

export default async function PublicLegal({ params }: { params: Promise<{ slug: string }> }) {
  const r = await load((await params).slug);
  if (!r) notFound();
  const m = LEGAL[r.kind];
  const { intro, rest } = splitIntro(r.doc.body);
  const date = new Intl.DateTimeFormat("en-GB", { dateStyle: "long", timeZone: "Europe/London" }).format(r.doc.publishedAt ?? r.doc.updatedAt);
  return (
    <main id="main" className="min-h-dvh bg-[#eef0ef] px-0 py-0 sm:px-6 sm:py-10">
      <LegalSheet meta={{ title: r.doc.title, ref: m.ref, version: `${r.doc.number}.0`, status: "Current", date, audience: m.audience }} intro={intro}>
        <AgreementText text={rest} />
      </LegalSheet>
    </main>
  );
}
