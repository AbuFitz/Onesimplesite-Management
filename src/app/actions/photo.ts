"use server";
import { redirect } from "next/navigation";
import { requireStaff, requireClient } from "@/modules/identity/session";
import { setMyPhoto, removeMyPhoto, setClientPhoto, removeClientPhoto, setCompanyLogo, removeCompanyLogo } from "@/modules/identity/photo";
import { DomainError } from "@/lib/errors";

export async function uploadPhotoAction(fd: FormData) {
  const ctx = await requireStaff();
  try { await setMyPhoto(ctx, fd.get("photo") as File | null); } catch (e) { redirect(`/account?error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save that picture.")}`); }
  redirect("/account?photo=1");
}
export async function removePhotoAction() { const ctx = await requireStaff(); await removeMyPhoto(ctx); redirect("/account?photo=0"); }

export async function uploadClientPhotoAction(fd: FormData) {
  const c = await requireClient();
  try { await setClientPhoto(c.userId, fd.get("photo") as File | null); } catch (e) { redirect(`/portal/account?error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save that picture.")}`); }
  redirect("/portal/account?photo=1");
}
export async function removeClientPhotoAction() { const c = await requireClient(); await removeClientPhoto(c.userId); redirect("/portal/account?photo=0"); }

export async function uploadLogoAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  const id = String(fd.get("customerId"));
  try { await setCompanyLogo(ctx, id, fd.get("photo") as File | null); } catch (e) { redirect(`/customers/${id}/details?error=${encodeURIComponent(e instanceof DomainError ? e.message : "Couldn't save that logo.")}`); }
  redirect(`/customers/${id}/details?logo=1`);
}
export async function removeLogoAction(fd: FormData) {
  const ctx = await requireStaff("customer.write");
  const id = String(fd.get("customerId"));
  await removeCompanyLogo(ctx, id);
  redirect(`/customers/${id}/details?logo=0`);
}
