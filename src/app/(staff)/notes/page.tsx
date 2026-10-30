import { FileText } from "lucide-react";

export const metadata = { title: "Notes" };
export default function Notes() {
  return (
    <div className="grid place-items-center py-24 text-center">
      <div><FileText size={28} aria-hidden className="mx-auto mb-3 text-muted" /><p className="font-semibold">Pick a page, or start a new one</p>
        <p className="text-sm text-muted">Pages save as you type and are shared with the team unless you make them private.</p></div>
    </div>
  );
}
