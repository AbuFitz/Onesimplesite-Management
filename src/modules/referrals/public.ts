import { z } from "zod";
import { db } from "@/lib/db";
import { audit, enqueue, nextRef } from "@/lib/audit";
import { manageLink } from "@/lib/env";
import { tidyPhone } from "@/lib/phone";
import { findByCode, attachFromLink, getSettings } from "./service";

const input = z.object({
  code: z.string().trim().min(4).max(12),
  business: z.string().trim().min(2, "Enter the business name.").max(160),
  name: z.string().trim().min(2, "Enter your name.").max(120),
  email: z.string().trim().toLowerCase().email("Enter a valid email.").max(200),
  phone: z.string().trim().max(40).optional().transform((v) => v || null),
  website: z.string().max(0).optional(), // honeypot: people leave it empty, bots fill it in
});

/**
 * A visitor filled in a customer's referral link. They become a lead and the customer is credited if it goes through.
 * Always answers the same way (even for duplicates or throttled requests) so the form can't be used to probe our customers.
 */
export async function submitReferralLead(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = input.safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const i = p.data;
  if (i.website) return { ok: true };
  const hit = await findByCode(i.code);
  if (!hit) return { ok: false, error: "This link isn't valid any more." };
  const ws = hit.workspaceId;
  if (!(await getSettings(ws)).enabled) return { ok: false, error: "This link isn't valid any more." };
  // Throttle: a handful per link a day, and a ceiling across the whole workspace per hour.
  const [perLink, perHour] = await Promise.all([
    db.referral.count({ where: { workspaceId: ws, via: "link", ...(hit.source.partnerId ? { partnerId: hit.source.partnerId } : { referrerId: hit.source.customerId }), createdAt: { gte: new Date(Date.now() - 864e5) } } }),
    db.referral.count({ where: { workspaceId: ws, via: "link", createdAt: { gte: new Date(Date.now() - 36e5) } } }),
  ]);
  if (perLink >= 5 || perHour >= 30) return { ok: true };
  const phone = i.phone ? tidyPhone(i.phone) : null;
  if (i.phone && phone === null) return { ok: false, error: "That phone number doesn't look right." };
  const dupe = await db.contact.findFirst({ where: { workspaceId: ws, email: { equals: i.email, mode: "insensitive" } }, select: { id: true } });
  if (dupe) return { ok: true }; // already known to us: nothing to create, and we don't say so
  const created = await db.$transaction(async (tx) => {
    const c = await tx.customer.create({ data: { workspaceId: ws, reference: await nextRef(tx, ws, "customer"), displayName: i.business, kind: "business", source: "Referral", phone } });
    await tx.contact.create({ data: { workspaceId: ws, customerId: c.id, name: i.name, email: i.email, phone, isPrimary: true } });
    await audit(tx, { workspaceId: ws, actor: null, action: "company.registered", targetType: "customer", targetId: c.id, customerId: c.id, detail: { via: "referral_link", referrer: hit.name } });
    return c;
  });
  await attachFromLink(ws, hit.source, created.id);
  await enqueue(db as never, ws, "email.referral_notice", `referral:${created.id}`, { to: "internal", referrer: hit.name, business: i.business, person: i.name, email: i.email, link: manageLink(`/customers/${created.id}`) });
  return { ok: true };
}

/** Someone found us themselves (no referral) and asked us to get in touch. Same safeguards as the referral form. */
export async function submitEnquiry(raw: unknown): Promise<{ ok: true } | { ok: false; error: string }> {
  const p = input.omit({ code: true }).safeParse(raw);
  if (!p.success) return { ok: false, error: p.error.issues[0]?.message ?? "Check the form and try again." };
  const i = p.data; if (i.website) return { ok: true };
  const ws = (await db.workspace.findFirst({ orderBy: { createdAt: "asc" }, select: { id: true } }))?.id; if (!ws) return { ok: false, error: "Try again later." };
  const recent = await db.customer.count({ where: { workspaceId: ws, source: "Website form", createdAt: { gte: new Date(Date.now() - 36e5) } } });
  if (recent >= 30) return { ok: true };
  const phone = i.phone ? tidyPhone(i.phone) : null;
  if (i.phone && phone === null) return { ok: false, error: "That phone number doesn't look right." };
  if (await db.contact.findFirst({ where: { workspaceId: ws, email: { equals: i.email, mode: "insensitive" } }, select: { id: true } })) return { ok: true };
  const c = await db.$transaction(async (tx) => {
    const cu = await tx.customer.create({ data: { workspaceId: ws, reference: await nextRef(tx, ws, "customer"), displayName: i.business, kind: "business", source: "Website form", phone } });
    await tx.contact.create({ data: { workspaceId: ws, customerId: cu.id, name: i.name, email: i.email, phone, isPrimary: true } });
    await audit(tx, { workspaceId: ws, actor: null, action: "company.registered", targetType: "customer", targetId: cu.id, customerId: cu.id, detail: { via: "get_started" } });
    return cu;
  });
  await enqueue(db as never, ws, "email.referral_notice", `enquiry:${c.id}`, { to: "internal", referrer: "Our website", business: i.business, person: i.name, email: i.email, link: manageLink(`/customers/${c.id}`) });
  return { ok: true };
}
