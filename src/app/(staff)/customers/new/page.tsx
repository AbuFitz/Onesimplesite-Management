import { requireStaff } from "@/modules/identity/session";
import { RecordHeader } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";

export const metadata = { title: "Add a company" };
export default async function NewBusiness() {
  await requireStaff("customer.write");
  return (<><RecordHeader back={{ href: "/customers", label: "Companies" }} title="Add a company" meta="Register who they are first. Tickets, quotes and payments come after." /><RegisterForm /></>);
}
