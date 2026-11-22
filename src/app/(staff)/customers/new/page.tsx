import { requireStaff } from "@/modules/identity/session";
import { db } from "@/lib/db";
import { RecordHeader } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";

export const metadata = { title: "Add a company" };
export default async function NewBusiness() {
  const ctx = await requireStaff("customer.write");
  const companies = (await db.customer.findMany({ where: { workspaceId: ctx.workspaceId, archivedAt: null }, orderBy: { displayName: "asc" }, take: 300, select: { id: true, displayName: true } })).map((c) => ({ id: c.id, name: c.displayName }));
  const partners = (await db.partner.findMany({ where: { workspaceId: ctx.workspaceId, active: true }, orderBy: { name: "asc" }, select: { id: true, name: true } }));
  return (<><RecordHeader back={{ href: "/customers", label: "Companies" }} title="Add a company" meta="Register who they are first. Tickets, quotes and payments come after." /><RegisterForm companies={companies} partners={partners} /></>);
}
