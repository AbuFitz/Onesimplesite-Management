import "dotenv/config";
import { writeFileSync } from "node:fs";
import { db } from "../src/lib/db";
import { createLead, updateCustomerDetails } from "../src/modules/crm/service";
import { createProposal } from "../src/modules/sales/service";
import { sendAgreement, submitSignature } from "../src/modules/signing/service";
import { updateCompany, ensureStarterTerms, saveTermsDraft, publishTerms } from "../src/modules/settings/service";
import { portalLink } from "../src/lib/env";

// Synthetic data only. Prepares: company + published terms, an open agreement for a phone/desktop screenshot,
// and a signed agreement for the client portal's Documents page (Harbour Bakery = client.a@example.test).
const ws = await db.workspace.findFirstOrThrow({ where: { name: "OneSimpleSite" } });
const m = await db.staffMembership.findFirstOrThrow({ where: { workspaceId: ws.id, status: "active", role: "owner" } });
const ctx = { userId: m.userId!, staffId: m.id, workspaceId: ws.id, role: m.role, name: m.displayName, email: m.email };
await updateCompany(ctx, { legalName: "OneSimpleSite Ltd", companyNumber: "01234567", registeredAddress: "1 High Street, London, N1 1AA" });
await ensureStarterTerms(ctx);
if (!(await db.termsVersion.findFirst({ where: { workspaceId: ws.id, status: "published" } }))) {
  const d = await db.termsVersion.findFirstOrThrow({ where: { workspaceId: ws.id }, orderBy: { number: "desc" } });
  const t = await saveTermsDraft(ctx, d.id, { title: "Terms and Conditions", body: "## The Services\n1.1 The Provider will design, build and launch the website described in the Order Summary.\n1.2 Changes to the scope are agreed in writing before work starts.\n\n## Fees and payment\n2.1 The Client will pay each invoice within 14 days of the invoice date.\n\n## Ownership\n3.1 Ownership of the finished website passes to the Client once all invoices are paid." });
  await publishTerms(ctx, t.id);
}
const draft = (title: string) => ({
  title, scope: "Design and build of a fast, mobile-friendly website with booking and contact forms.", terms: "",
  requirements: { pages: "Home\nMenu\nAbout\nContact", features: "Online booking form\nOpening hours and map", integrations: "Google Analytics\nMailchimp sign-up", domainHosting: "Client owns the domain; we host and maintain", contentBy: "Client supplies logo and photos; we write the copy", timeline: "Launch within six weeks of signing", payment: "50% on signing\n50% on launch" },
  lines: [{ description: "Website design and build", quantity: 1, unitMinor: 180000, recurring: false }, { description: "Hosting and maintenance", quantity: 1, unitMinor: 3500, recurring: true }], recurringPeriod: "month" as const,
});

async function agreementFor(name: string, email: string, title: string, sign: boolean) {
  let c = await db.customer.findFirst({ where: { workspaceId: ws.id, displayName: name } });
  if (!c) { const l = await createLead(ctx, { displayName: name, contactName: "Casey Morgan", email }); c = await db.customer.findUniqueOrThrow({ where: { id: l.customerId } }); }
  await updateCustomerDetails(ctx, c.id, c.version, { kind: "business", legalName: `${name} Ltd`, companyNumber: "07654321", billingAddress: "2 Quay Road, Bristol, BS1 4AA" });
  const p = await createProposal(ctx, c.id, null, draft(title));
  const s = await sendAgreement(ctx, p.id, { name: "Casey Morgan", email });
  if (sign) await submitSignature(s.token, { name: "Casey Morgan", method: "typed", consent: true }, {});
  return s;
}
await agreementFor("Harbour Bakery", "client.a@example.test", `Website for Harbour Bakery ${Date.now() % 1000}`, true);
const open = await agreementFor("Northside Physio", "casey@northside.example", "Website for Northside Physio", false);
writeFileSync(process.env.SHOWCASE_JSON ?? "/tmp/showcase.json", JSON.stringify({ sign: portalLink(`/s/${open.token}`) }));
console.log("ok");
process.exit(0);
