import Page from "@/app/(staff)/support/[id]/page";
import { RecordModal } from "@/components/record-modal";

/** Opens over the list it was clicked from. Visiting the address directly still gives the full page. */
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return <RecordModal><Page {...props} /></RecordModal>;
}
