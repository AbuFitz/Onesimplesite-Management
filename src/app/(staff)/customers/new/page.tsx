import { requireStaff } from "@/modules/identity/session";
import { RecordHeader } from "@/components/ui";
import { RegisterForm } from "@/components/register-form";

export const metadata = { title: "Add a business" };
export default async function NewBusiness() {
  await requireStaff("customer.write");
  return (<><RecordHeader back={{ href: "/customers", label: "Businesses" }} title="Add a business" meta="Register who they are first. Tickets, quotes and payments come after." /><RegisterForm /></>);
}
