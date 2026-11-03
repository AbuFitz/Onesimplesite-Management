import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentValues } from "@/modules/settings/plans";
import { fillVars } from "@/modules/settings/variables";
import { LEGAL_PAGES, LEGAL_PAGES_UPDATED } from "@/modules/legal-public/content";
import { AgreementText } from "@/components/agreement";
import { LegalSheet } from "@/components/legal-sheet";
import { LegalLinks } from "@/components/legal-links";
import { PublicShell } from "@/components/public-shell";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: LEGAL_PAGES[slug]?.title ?? "Legal", robots: { index: false } }; }

/** The portals' privacy, cookie and terms pages. Written in code; only our company details come from Settings. */
export default async function PublicLegal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL_PAGES[slug];
  if (!page) notFound();
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } });
  const vars = w ? await documentValues(w.id) : {};
  return (
    <PublicShell label="Legal">
      <LegalSheet intro={page.intro} meta={{ title: page.title, ref: page.ref, version: page.version, status: "Current", date: LEGAL_PAGES_UPDATED, audience: "Public" }}>
        <AgreementText text={fillVars(page.body, vars)} />
      </LegalSheet>
      <LegalLinks className="mt-8" />
    </PublicShell>
  );
}
