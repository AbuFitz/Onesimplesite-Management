import { requireClient } from "@/modules/identity/session";
export const metadata = { title: "Help" };
export default async function Help() {
  await requireClient();
  return (<><h1 className="mb-4">Help</h1><p>Email <a className="underline" href="mailto:support@onesimplesite.co.uk">support@onesimplesite.co.uk</a> and include your business name. Online tickets are not available yet.</p></>);
}
