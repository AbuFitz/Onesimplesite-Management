import { redirect } from "next/navigation";

/** Support tickets now live in the one Tickets list. */
export default async function Support() { redirect("/tickets?type=support"); }
