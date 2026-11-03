/** Ticket status in the client's words, with colour. */
export const CLIENT_STATUS: Record<string, { label: string; cls: string }> = {
  open: { label: "We've got it", cls: "bg-butter text-[#5c4700]" },
  in_progress: { label: "We're on it", cls: "bg-sky text-[#0b3b57]" },
  waiting_customer: { label: "Waiting for you", cls: "bg-blush text-[#7a2e12]" },
  resolved: { label: "Sorted", cls: "bg-mint text-[#0a5a3d]" },
  closed: { label: "Closed", cls: "bg-bone text-muted" },
};
export function ClientStatus({ status }: { status: string }) {
  const s = CLIENT_STATUS[status] ?? { label: status, cls: "bg-bone" };
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-bold ${s.cls}`}>{s.label}</span>;
}
