import { notFound } from "next/navigation";
import { renderEmail, type TemplateName } from "@/emails/templates";

const fx = {
  proposal: { to: "x", ref: "P-0007", title: "Harbour Bakery website", version: 2, link: "https://portal.example/p/token", validUntil: "30 November 2026", oneOff: "£1,500.00", recurring: "£25.00 per month" },
  contract_request: { to: "x", signerName: "Casey Morgan", title: "Harbour Bakery website", ref: "K-0003", link: "https://portal.example/s/token", expires: "13 November 2026", business: "Harbour Bakery" },
  signing_confirmation: { to: "x", signerName: "Casey Morgan", title: "Harbour Bakery website", ref: "K-0003", signedAt: "30 October 2026 at 14:05", fileSha: "a".repeat(64), hasAttachment: true },
  signing_notice: { to: "x", title: "Harbour Bakery website", ref: "K-0003", business: "Harbour Bakery", signerName: "Casey Morgan", signerEmail: "casey@harbour.example", signedAt: "30 October 2026 at 14:05", link: "https://manage.example/contracts/1", fileSha: "a".repeat(64) },
  password_reset: { to: "x", name: "Casey Morgan", link: "https://manage.example/reset-password?token=abc", minutes: 60 },
  password_changed: { to: "x", name: "Casey Morgan", when: "30 October 2026 at 14:05" },
  staff_invitation: { to: "x", name: "Matthew Redican", inviter: "Abukar Sharif", roleLabel: "Team member", link: "https://manage.example/invite/token", expires: "6 November 2026" },
  invitation: { to: "x", businessName: "Harbour Bakery", inviter: "Farhan Mahmood", link: "https://portal.example/invite/token", expires: "6 November 2026" },
} as const;

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  if (process.env.APP_ENV !== "development") notFound();
  const { name } = await params;
  if (!(name in fx)) notFound();
  const r = await renderEmail(name as TemplateName, fx[name as TemplateName] as never);
  const text = new URL(req.url).searchParams.has("text");
  return new Response(text ? r.text : r.html, { headers: { "Content-Type": text ? "text/plain; charset=utf-8" : "text/html; charset=utf-8" } });
}
