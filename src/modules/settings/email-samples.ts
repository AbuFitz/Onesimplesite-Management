import { renderEmail, type TemplateName } from "@/emails/templates";

/** Every email the system sends, in the order a customer meets them, with sample content. Used by the preview and the test sender. */
export const EMAILS: { id: TemplateName; label: string; audience: "Customer" | "Team"; when: string; sender: "general" | "noreply" | "legal" | "support" }[] = [
  { id: "contract_request", label: "Order to review and sign", audience: "Customer", when: "When you press Send for signature on a ticket. One email, one link.", sender: "legal" },
  { id: "signing_confirmation", label: "Signed copy", audience: "Customer", when: "Straight after they sign. The signed PDF is attached.", sender: "legal" },
  { id: "invitation", label: "Portal invitation", audience: "Customer", when: "When you invite a customer to their client portal.", sender: "noreply" },
  { id: "password_reset", label: "Password reset", audience: "Customer", when: "When anyone asks to reset a password.", sender: "noreply" },
  { id: "password_changed", label: "Password changed", audience: "Customer", when: "After a password is changed, as a safety notice.", sender: "noreply" },
  { id: "signing_notice", label: "Signed notice to us", audience: "Team", when: "Sent to hello@ when a customer signs.", sender: "noreply" },
  { id: "staff_invitation", label: "Team invitation", audience: "Team", when: "When you add someone to the team.", sender: "noreply" },
  { id: "backup_reminder", label: "Backup reminder", audience: "Team", when: "Weekly, if no backup has been taken.", sender: "noreply" },
];

// Sample links open real pages: the sample signing page, and the sign-in pages.
const SIGN = "https://portal.onesimplesite.co.uk/s/sample";
const PORTAL = "https://portal.onesimplesite.co.uk/login";
const MANAGE = "https://manage.onesimplesite.co.uk/login";

export function sampleEmail(id: TemplateName) {
  const to = "customer@example.com";
  switch (id) {
    case "contract_request": return renderEmail(id, { to, signerName: "Alex", title: "Website for Sample Café", ref: "OSS-OF-2026-047", link: SIGN, expires: "30 November 2026", business: "Sample Café Ltd" });
    case "signing_confirmation": return renderEmail(id, { to, signerName: "Alex", title: "Website for Sample Café", ref: "OSS-OF-2026-047", signedAt: "2 November 2026, 14:05", fileSha: "9f2c1ab07d3e44f1", hasAttachment: true });
    case "invitation": return renderEmail(id, { to, businessName: "Sample Café Ltd", inviter: "Jamie at OneSimpleSite", link: PORTAL, expires: "9 November 2026" });
    case "password_reset": return renderEmail(id, { to, name: "Alex", link: PORTAL, minutes: 60 });
    case "password_changed": return renderEmail(id, { to, name: "Alex", when: "2 November 2026, 14:05" });
    case "signing_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", title: "Website for Sample Café", ref: "OSS-OF-2026-047", business: "Sample Café Ltd", signerName: "Alex", signerEmail: to, signedAt: "2 November 2026, 14:05", link: "https://manage.onesimplesite.co.uk/pipeline?stage=won", fileSha: "9f2c1ab07d3e44f1" });
    case "staff_invitation": return renderEmail(id, { to: "new.person@onesimplesite.co.uk", name: "New Person", inviter: "Jamie", roleLabel: "Team member", link: MANAGE, expires: "9 November 2026" });
    case "backup_reminder": return renderEmail(id, { to: "hello@onesimplesite.co.uk", lastBackup: "26 October 2026", link: "https://manage.onesimplesite.co.uk/backup" });
    default: return renderEmail("password_changed", { to, name: "Alex", when: "" });
  }
}
