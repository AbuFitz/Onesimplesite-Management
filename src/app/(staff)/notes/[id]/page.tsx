import { redirect } from "next/navigation";
/** Old address: Notes became the Team Board. */
export default async function Old({ params }: { params: Promise<{ id: string }> }) { const { id } = await params; redirect(`/board/${id}`); }
