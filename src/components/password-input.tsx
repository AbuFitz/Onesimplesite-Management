"use client";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

/** A password box with an eye to see what you typed. Keeps the browser's password-manager behaviour. */
export function PasswordInput({ id = "password", name = "password", autoComplete = "current-password", minLength, required = true }: { id?: string; name?: string; autoComplete?: string; minLength?: number; required?: boolean }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input id={id} name={name} type={show ? "text" : "password"} className="field !pr-12" autoComplete={autoComplete} minLength={minLength} required={required} autoCapitalize="none" spellCheck={false} />
      <button type="button" onClick={() => setShow((v) => !v)} aria-pressed={show} aria-label={show ? "Hide password" : "Show password"} className="absolute right-1.5 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-lg text-muted hover:bg-bone hover:text-ink">
        {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
      </button>
    </div>
  );
}
