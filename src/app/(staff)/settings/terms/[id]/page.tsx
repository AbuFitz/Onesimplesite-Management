import { redirect } from "next/navigation";
/** Old address, kept so saved links still work. */
export default async function Old({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/settings/legal/terms/${id}`); }
