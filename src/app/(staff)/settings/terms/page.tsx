import { redirect } from "next/navigation";
/** Old address, kept so saved links still work. */
export default function Old() { redirect("/settings/legal/terms"); }
