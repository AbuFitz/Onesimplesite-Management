"use client";
import { ErrorCard } from "@/components/error-card";
export default function StaffError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) { return <ErrorCard error={error} reset={reset} home="/" />; }
