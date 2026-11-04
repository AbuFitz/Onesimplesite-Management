import { z } from "zod";
import { tidyPhone } from "@/lib/phone";
import { checkAddress, printedAddress, normalisePostcode } from "@/lib/address";
import { db } from "@/lib/db";
import { audit, nextRef } from "@/lib/audit";
import { DomainError, forbidden } from "@/lib/errors";
import { can } from "@/modules/identity/permissions";
import type { StaffCtx } from "@/modules/identity/session";

const opt = (max = 200) => z.string().trim().max(max).optional().transform((v) => v || null);

const registerInput = z.object({
  kind: z.enum(["business", "sole_trader", "individual"]),
  displayName: z.string().trim().min(2, "Enter the name they trade under.").max(160),
  legalName: opt(160), companyNumber: opt(20), vatNumber: opt(20), addressLine1: opt(120), addressLine2: opt(120), postcode: opt(10), website: opt(200), phone: opt(40),
  businessType: opt(80), town: opt(80), source: opt(60),
  contactName: z.string().trim().min(2, "Enter the main contact's name.").max(120),
  contactEmail: z.string().trim().toLowerCase().email("Enter the main contact's email.").max(200),
  contactPhone: opt(40).transform((v, ctx) => { if (!v) return null; const t = tidyPhone(v); if (t === null) { ctx.addIssue({ code: "custom", message: "That phone number doesn't look right. Check the digits." }); return null; } return t; }), contactPosition: opt(80),
}).superRefine((v, ctx) => { const m = checkAddress(v); if (m) ctx.addIssue({ code: "custom", message: m, path: ["postcode"] }); });

/** Registers a new company with its first person, in one go. Sales tickets and payments are added after. */
export async function registerBusiness(ctx: StaffCtx, raw: unknown) {
  if (!can(ctx.role, "customer.write")) throw forbidden();
  const i = registerInput.parse(raw);
  const postcode = i.postcode ? normalisePostcode(i.postcode) : null;
  const billingAddress = printedAddress({ ...i, postcode }) || null;
  if (i.kind === "business" && !i.legalName) i.legalName = i.displayName;
  const dupe = await db.contact.findFirst({ where: { workspaceId: ctx.workspaceId, email: { equals: i.contactEmail, mode: "insensitive" } }, select: { customer: { select: { displayName: true } } } });
  if (dupe) throw new DomainError("conflict", `That email is already a contact at ${dupe.customer.displayName}. Open that company and add the ticket there.`);
  return db.$transaction(async (tx) => {
    const reference = await nextRef(tx, ctx.workspaceId, "customer");
    const c = await tx.customer.create({ data: { workspaceId: ctx.workspaceId, reference, displayName: i.displayName, legalName: i.legalName, kind: i.kind, companyNumber: i.kind === "business" ? i.companyNumber : null, vatNumber: i.vatNumber, billingAddress, addressLine1: i.addressLine1, addressLine2: i.addressLine2, postcode, website: i.website, phone: i.phone, businessType: i.businessType, town: i.town, source: i.source, ownerId: ctx.staffId } });
    await tx.contact.create({ data: { workspaceId: ctx.workspaceId, customerId: c.id, name: i.contactName, email: i.contactEmail, phone: i.contactPhone, position: i.contactPosition, isPrimary: true } });
    await audit(tx, { workspaceId: ctx.workspaceId, actor: { userId: ctx.userId, label: ctx.name }, action: "company.registered", targetType: "customer", targetId: c.id, customerId: c.id });
    return c;
  });
}
