"use server";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { requireStaff } from "@/modules/identity/session";
import { registerBusiness } from "@/modules/crm/register";
import { DomainError } from "@/lib/errors";

export async function registerBusinessAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const ctx = await requireStaff("customer.write");
  const g = (k: string) => (fd.get(k) ? String(fd.get(k)) : undefined);
  let id: string;
  try {
    id = (await registerBusiness(ctx, { kind: g("kind") ?? "business", displayName: g("displayName"), legalName: g("legalName"), companyNumber: g("companyNumber"), vatNumber: g("vatNumber"), addressLine1: g("addressLine1"), addressLine2: g("addressLine2"), postcode: g("postcode"), website: g("website"), phone: g("phone"), businessType: g("businessType"), town: g("town"), source: g("source"), contactName: g("contactName"), contactEmail: g("contactEmail"), contactPhone: g("contactPhone"), contactPosition: g("contactPosition") })).id;
  } catch (e) { return { error: e instanceof DomainError ? e.message : e instanceof ZodError ? e.issues.map((i) => i.message).join(" ") : "Something went wrong and nothing was saved." }; }
  redirect(String(fd.get("next") ?? "") === "ticket" ? `/tickets/new?business=${id}` : `/customers/${id}?tab=people&done=${encodeURIComponent("Company added. Invite their main contact to the portal when you're ready.")}`);
}
