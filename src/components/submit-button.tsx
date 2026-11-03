"use client";
import { useFormStatus } from "react-dom";

/** A submit button that locks itself while the form is sending, so one press is one action. */
export function SubmitButton({ children, className = "btn", pendingText = "Sending…" }: { children: React.ReactNode; className?: string; pendingText?: string }) {
  const { pending } = useFormStatus();
  return <button className={className} disabled={pending} aria-disabled={pending}>{pending ? pendingText : children}</button>;
}
