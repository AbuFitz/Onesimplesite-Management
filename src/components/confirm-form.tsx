"use client";
import type { ReactNode } from "react";

/** A form that asks "are you sure?" before it submits. For deletes. */
export function ConfirmForm({ action, message, children, className }: { action: (fd: FormData) => void | Promise<void>; message: string; children: ReactNode; className?: string }) {
  return <form action={action} className={className} onSubmit={(e) => { if (!window.confirm(message)) e.preventDefault(); }}>{children}</form>;
}
