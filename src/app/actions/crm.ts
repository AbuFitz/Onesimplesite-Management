"use server";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { flushEmails } from "@/lib/flush-email";
import { createLead, setOpportunityStage } from "@/modules/crm/service";
import { createProposal, saveDraft, sendProposal, reviseProposal } from "@/modules/sales/service";
import { markContractSent, recordContractCompletion } from "@/modules/contracts/service";
import { DomainError } from "@/lib/errors";
import { ZodError } from "zod";

const msg = (e: unknown) => (e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join("; ") : "Something went wrong. Nothing was changed.");
const back = (path: string, e: unknown): never => redirect(`${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg(e))}`);

export async function createLeadAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  let id: string;
  try {
    id = (await createLead(ctx, Object.fromEntries(fd))).customerId;
  } catch (e) { return back("/customers/new", e); }
  redirect(`/customers/${id}`);
}

export async function stageAction(fd: FormData) {
  const ctx = await requireStaff("opportunity.write");
  try {
    await setOpportunityStage(ctx, String(fd.get("id")), fd.get("stage") as never, Number(fd.get("version")), String(fd.get("lossReason") ?? ""));
  } catch (e) { return back("/pipeline", e); }
  redirect("/pipeline");
}

function parseProposal(fd: FormData) {
  const lines = [] as { description: string; quantity: number; unitMinor: number; recurring: boolean }[];
  for (let i = 0; i < 8; i++) {
    const d = String(fd.get(`l${i}d`) ?? "").trim();
    if (!d) continue;
    lines.push({ description: d, quantity: Number(fd.get(`l${i}q`) || 1), unitMinor: Math.round(Number(fd.get(`l${i}p`) || 0) * 100), recurring: fd.get(`l${i}r`) === "on" });
  }
  const requirements = Object.fromEntries(["pages", "features", "integrations", "domainHosting", "contentBy", "timeline", "payment", "notes"].map((k) => [k, String(fd.get(`req_${k}`) ?? "")]).filter(([, v]) => v.trim()));
  return { requirements, title: String(fd.get("title") ?? ""), scope: String(fd.get("scope") ?? ""), terms: String(fd.get("terms") ?? ""), validUntil: fd.get("validUntil") || undefined, recurringPeriod: (fd.get("recurringPeriod") || undefined) as "month" | "year" | undefined, lines };
}

export async function createProposalAction(fd: FormData) {
  const ctx = await requireStaff("proposal.write");
  const customerId = String(fd.get("customerId"));
  let id: string;
  try {
    // Link to the customer's open deal so it moves along when the quote is sent and signed.
    const opp = await db.opportunity.findFirst({ where: { customerId, workspaceId: ctx.workspaceId, stage: { notIn: ["won", "lost"] } }, orderBy: { updatedAt: "desc" }, select: { id: true } });
    id = (await createProposal(ctx, customerId, String(fd.get("opportunityId") || "") || opp?.id || null, parseProposal(fd))).id;
  } catch (e) { return back(customerId ? `/proposals/new?customer=${customerId}` : "/proposals/new", e); }
  redirect(`/proposals/${id}`);
}

export async function saveDraftAction(fd: FormData) {
  const ctx = await requireStaff("proposal.write");
  const id = String(fd.get("id"));
  try { await saveDraft(ctx, id, Number(fd.get("version")), parseProposal(fd)); } catch (e) { return back(`/proposals/${id}`, e); }
  redirect(`/proposals/${id}?saved=1`);
}

export async function sendProposalAction(fd: FormData) {
  const ctx = await requireStaff("proposal.send");
  const id = String(fd.get("id"));
  try { await sendProposal(ctx, id, String(fd.get("email"))); flushEmails(); } catch (e) { return back(`/proposals/${id}`, e); }
  redirect(`/proposals/${id}?sent=1`);
}

export async function reviseProposalAction(fd: FormData) {
  const ctx = await requireStaff("proposal.write");
  const id = String(fd.get("id"));
  try { await reviseProposal(ctx, id); } catch (e) { return back(`/proposals/${id}`, e); }
  redirect(`/proposals/${id}`);
}

export async function contractSentAction(fd: FormData) {
  const ctx = await requireStaff("contract.send");
  const id = String(fd.get("id"));
  try { await markContractSent(ctx, id); } catch (e) { return back(`/contracts/${id}`, e); }
  redirect(`/contracts/${id}`);
}

export async function completionAction(fd: FormData) {
  const ctx = await requireStaff("contract.record_completion");
  const id = String(fd.get("id"));
  let projectId: string;
  try { projectId = (await recordContractCompletion(ctx, id, { evidence: fd.get("evidence") })).projectId; flushEmails(); } catch (e) { return back(`/contracts/${id}`, e); }
  redirect(`/projects/${projectId}`);
}

import { sendForSigning, voidSigning } from "@/modules/signing/service";
import { inviteClientContact } from "@/modules/crm/invite";

export async function sendForSigningAction(fd: FormData) {
  const ctx = await requireStaff("contract.send");
  const id = String(fd.get("id"));
  try { await sendForSigning(ctx, id, { name: fd.get("name"), email: fd.get("email") }); flushEmails(); } catch (e) { return back(`/contracts/${id}`, e); }
  redirect(`/contracts/${id}?sent=1`);
}
export async function voidSigningAction(fd: FormData) {
  const ctx = await requireStaff("contract.void");
  const id = String(fd.get("id"));
  try { await voidSigning(ctx, id); } catch (e) { return back(`/contracts/${id}`, e); }
  redirect(`/contracts/${id}`);
}
export async function inviteClientAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  const id = String(fd.get("customerId"));
  try { await inviteClientContact(ctx, id, String(fd.get("contactId"))); flushEmails(); } catch (e) { return back(`/customers/${id}`, e); }
  redirect(`/customers/${id}?invited=1`);
}

import { updateCustomerDetails } from "@/modules/crm/service";
export async function updateDetailsAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  const id = String(fd.get("id"));
  try {
    await updateCustomerDetails(ctx, id, Number(fd.get("version")), { kind: fd.get("kind") || "business", legalName: fd.get("legalName") || undefined, companyNumber: fd.get("companyNumber") || undefined, vatNumber: fd.get("vatNumber") || undefined, billingAddress: fd.get("billingAddress") || undefined, website: fd.get("website") || undefined, phone: fd.get("phone") || undefined });
  } catch (e) { return back(`/customers/${id}/details`, e); }
  redirect(`/customers/${id}?details=saved`);
}

import { sendAgreement } from "@/modules/signing/service";
export async function sendAgreementAction(fd: FormData) {
  const ctx = await requireStaff("proposal.send");
  const id = String(fd.get("id"));
  try { await sendAgreement(ctx, id, { name: fd.get("name"), email: fd.get("email") }); flushEmails(); } catch (e) { return back(`/proposals/${id}`, e); }
  redirect(`/proposals/${id}?sent=1`);
}
