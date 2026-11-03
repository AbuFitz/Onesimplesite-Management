"use server";
import { redirect } from "next/navigation";
import { requireStaff } from "@/modules/identity/session";
import { setMyPhoto, removeMyPhoto } from "@/modules/identity/photo";
import { DomainError } from "@/lib/errors";

export async function uploadPhotoAction(fd: FormData) {
  const ctx = await requireStaff();
  try { await setMyPhoto(ctx, fd.get("photo") as File | null); } catch (e) { redirect(`/account?error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save that picture.")}`); }
  redirect("/account?photo=1");
}
export async function removePhotoAction() { const ctx = await requireStaff(); await removeMyPhoto(ctx); redirect("/account?photo=0"); }
