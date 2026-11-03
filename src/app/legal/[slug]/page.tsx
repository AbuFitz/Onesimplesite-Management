import { notFound } from "next/navigation";
import { db } from "@/lib/db";
import { documentValues } from "@/modules/settings/plans";
import { fillVars } from "@/modules/settings/variables";
import { LEGAL_PAGES, LEGAL_PAGES_UPDATED } from "@/modules/legal-public/content";
import { PolicyPage } from "@/components/policy-page";

export const dynamic = "force-dynamic";
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return { title: LEGAL_PAGES[slug]?.title ?? "Legal", robots: { index: false } }; }

/** The portals' privacy, cookie and terms pages: a normal readable page. Written in code; only our company details come from Settings. */
export default async function PublicLegal({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const page = LEGAL_PAGES[slug];
  if (!page) notFound();
  const w = await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true, legalName: true, registeredAddress: true } });
  const vars = { ...(w ? await documentValues(w.id) : {}), legal_name: w?.legalName?.trim() || "OneSimpleSite", registered_office: w?.registeredAddress?.trim().replace(/\s*\n\s*/g, ", ") || "United Kingdom" };
  const others = Object.values(LEGAL_PAGES).filter((p) => p.slug !== slug).map((p) => ({ href: `/legal/${p.slug}`, label: p.title.replace("Portal ", "").replace(" Notice", "").replace(" of Use", " of use") }));
  return <PolicyPage title={page.title} intro={page.intro} version={page.version} updated={LEGAL_PAGES_UPDATED} body={fillVars(page.body, vars)} others={others} />;
}
