"use server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { ZodError } from "zod";
import { acceptProposal } from "@/modules/sales/service";
import { DomainError } from "@/lib/errors";

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
