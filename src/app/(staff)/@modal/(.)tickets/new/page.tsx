import Page from "@/app/(staff)/tickets/new/page";
import { RecordModal } from "@/components/record-modal";

/** "New ticket" opens over the page you were on, and saving it brings you straight back. Visiting the address directly gives the full page. */
export default function Modal(props: React.ComponentProps<typeof Page>) {
  return <RecordModal variant="create" title="New ticket"><div data-popup><Page {...props} /></div></RecordModal>;
}
