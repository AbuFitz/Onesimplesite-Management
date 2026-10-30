import { redirect } from "next/navigation";

/** Old address. Adding a customer now happens in the New ticket popup. */
export default function NewLead() {
  redirect("/?new=ticket");
}
