"use server";
import { requireStaff } from "@/modules/identity/session";
import { sendTestEmails, type TestResult } from "@/modules/settings/email-test";
import type { TemplateName } from "@/emails/templates";

export async function sendTestEmailsAction(only?: string): Promise<{ to: string; results: TestResult[] }> {
  const ctx = await requireStaff("settings.write");
  const results = await sendTestEmails(ctx, (only || undefined) as TemplateName | undefined);
  const { internalNoticeTo } = await import("@/lib/env");
  return { to: internalNoticeTo(), results };
}
