"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { acceptProposal } from "@/modules/sales/service";
import { DomainError } from "@/lib/errors";
import { submitSignature, declineSigning } from "@/modules/signing/service";

export async function acceptProposalAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  const h = await headers();
  // Only trust a forwarded address when deployed behind our own proxy; otherwise record nothing.
  const ip = process.env.TRUST_PROXY === "1" ? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null : null;
  try {
    await acceptProposal(token, { name: fd.get("name"), consent: fd.get("consent") === "on" }, { ip, userAgent: h.get("user-agent") });
  } catch (e) {
    const m = e instanceof DomainError ? e.message : e instanceof ZodError ? "Enter your name and tick the confirmation." : "Something went wrong. Nothing was recorded; please try again.";
    redirect(`/p/${encodeURIComponent(token)}?error=${encodeURIComponent(m)}`);
  }
  redirect(`/p/${encodeURIComponent(token)}/accepted`);
}

export async function signAction(_: unknown, fd: FormData): Promise<{ error?: string }> {
  const token = String(fd.get("token") ?? "");
  const h = await headers();
  const ip = process.env.TRUST_PROXY === "1" ? h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null : null;
  try {
    await submitSignature(token, { name: fd.get("name"), method: fd.get("method"), image: String(fd.get("image") ?? "") || undefined, consent: fd.get("consent") === "on" }, { ip, userAgent: h.get("user-agent") });
  } catch (e) {
    if (e instanceof DomainError) return { error: e.message };
    if (e instanceof ZodError) return { error: e.issues.map((i) => i.message).join(" ") };
    return { error: "Something went wrong and nothing was recorded. Please try again." };
  }
  redirect(`/s/${encodeURIComponent(token)}/done`);
}

export async function declineAction(fd: FormData) {
  const token = String(fd.get("token") ?? "");
  try { await declineSigning(token, String(fd.get("reason") ?? "")); } catch { /* fall through to the page, which explains state */ }
  redirect(`/s/${encodeURIComponent(token)}`);
}
