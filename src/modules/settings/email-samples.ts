import { renderEmail, type TemplateName } from "@/emails/templates";

/** Every email the system sends, in the order a customer meets them, with sample content. Used by the preview and the test sender. */
export const EMAILS: { id: TemplateName; label: string; audience: "Customer" | "Team"; when: string; sender: "general" | "noreply" | "legal" | "support" }[] = [
  { id: "contract_request", label: "Order to review and sign", audience: "Customer", when: "When you press Send for signature on a ticket. One email, one link.", sender: "legal" },
  { id: "signing_confirmation", label: "Signed copy", audience: "Customer", when: "Straight after they sign. The signed PDF is attached.", sender: "legal" },
  { id: "invitation", label: "Portal invitation", audience: "Customer", when: "When you invite a customer to their client portal.", sender: "noreply" },
  { id: "password_reset", label: "Password reset", audience: "Customer", when: "When anyone asks to reset a password.", sender: "noreply" },
  { id: "password_changed", label: "Password changed", audience: "Customer", when: "After a password is changed, as a safety notice.", sender: "noreply" },
  { id: "payment_received", label: "Payment received", audience: "Customer", when: "When a website payment is made by card, or you mark one as paid.", sender: "support" },
  { id: "plan_started", label: "Monthly plan live", audience: "Customer", when: "When a customer starts their monthly plan.", sender: "support" },
  { id: "payment_failed", label: "Payment didn't go through", audience: "Customer", when: "If a monthly payment is declined.", sender: "support" },
  { id: "payment_notice", label: "Payment update for us", audience: "Team", when: "When a payment is received, a plan starts or is cancelled, or a payment fails.", sender: "noreply" },
  { id: "ticket_received", label: "Ticket received", audience: "Customer", when: "As soon as a customer raises a ticket in their portal.", sender: "support" },
  { id: "ticket_reply", label: "Reply to a ticket", audience: "Customer", when: "When the team replies to a customer on a ticket. Sent as the person who replied.", sender: "support" },
  { id: "signing_notice", label: "Signed notice to us", audience: "Team", when: "Sent to hello@ when a customer signs.", sender: "noreply" },
  { id: "ticket_notice", label: "New ticket for us", audience: "Team", when: "When a customer raises a ticket or replies to one.", sender: "noreply" },
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
    case "payment_received": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", what: "Website", amount: "£1,200.00", paidOn: "3 November 2026", link: PORTAL });
    case "plan_started": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", amount: "£49.00", link: PORTAL });
    case "payment_failed": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", what: "Monthly plan", amount: "£49.00", link: PORTAL });
    case "payment_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", event: "paid", business: "Sample Café Ltd", ref: "OSS-OF-2026-047", what: "Website", amount: "£1,200.00", link: MANAGE });
    case "ticket_received": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", expect: "We reply within one working day.", link: PORTAL });
    case "ticket_reply": return renderEmail(id, { to, name: "Alex Sample", staffName: "Abukar Sharif", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", message: "Thanks Alex. I've found the problem and fixed it. Could you send a test message and let me know it arrives?", link: PORTAL });
    case "ticket_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", business: "Sample Café Ltd", person: "Alex Sample", priority: "high", excerpt: "Since yesterday nothing arrives when someone fills in the contact form.", link: MANAGE });
    case "staff_invitation": return renderEmail(id, { to: "new.person@onesimplesite.co.uk", name: "New Person", inviter: "Jamie", roleLabel: "Team member", link: MANAGE, expires: "9 November 2026" });
    case "backup_reminder": return renderEmail(id, { to: "hello@onesimplesite.co.uk", lastBackup: "26 October 2026", link: "https://manage.onesimplesite.co.uk/backup" });
    default: return renderEmail("password_changed", { to, name: "Alex", when: "" });
  }
}
