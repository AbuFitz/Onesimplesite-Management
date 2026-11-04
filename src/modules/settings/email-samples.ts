import { renderEmail, type TemplateName } from "@/emails/templates";

/** Every email the system sends, in the order a customer meets them, with sample content. Used by the preview and the test sender. */
export const EMAILS: { id: TemplateName; label: string; audience: "Customer" | "Team"; when: string; sender: "general" | "noreply" | "legal" | "support" }[] = [
  { id: "contract_request", label: "Order to review and sign", audience: "Customer", when: "When you press Send for signature on a ticket. One email, one link.", sender: "legal" },
  { id: "signing_confirmation", label: "Signed copy", audience: "Customer", when: "Straight after they sign. The signed PDF is attached.", sender: "legal" },
  { id: "invitation", label: "Portal invitation", audience: "Customer", when: "When you invite a customer to their client portal.", sender: "noreply" },
  { id: "password_reset", label: "Password reset", audience: "Customer", when: "When anyone asks to reset a password.", sender: "noreply" },
  { id: "login_code", label: "Sign-in code", audience: "Customer", when: "When someone signs in on a new device and one-time codes are switched on.", sender: "noreply" },
  { id: "password_changed", label: "Password changed", audience: "Customer", when: "After a password is changed, as a safety notice.", sender: "noreply" },
  { id: "payment_received", label: "Payment received", audience: "Customer", when: "When a website payment is made by card, or you mark one as paid.", sender: "support" },
  { id: "plan_started", label: "Monthly plan live", audience: "Customer", when: "When a customer starts their monthly plan.", sender: "support" },
  { id: "payment_failed", label: "Payment didn't go through", audience: "Customer", when: "If a monthly payment is declined.", sender: "support" },
  { id: "payment_notice", label: "Payment update for us", audience: "Team", when: "When a payment is received, a plan starts or is cancelled, or a payment fails.", sender: "noreply" },
  { id: "access_request_decision", label: "Access request answered", audience: "Customer", when: "When we approve or decline a request to add someone to the portal.", sender: "support" },
  { id: "access_request_notice", label: "Portal access request", audience: "Team", when: "When a customer asks for another person to get portal access.", sender: "noreply" },
  { id: "change_request_quote", label: "Change priced: please approve", audience: "Customer", when: "When we price a change that's outside their plan.", sender: "support" },
  { id: "ticket_resolved", label: "Ticket sorted", audience: "Customer", when: "When we mark a ticket as sorted.", sender: "support" },
  { id: "ticket_reminder", label: "Waiting to hear from you", audience: "Customer", when: "3 days, then 7 days, after we reply and hear nothing back.", sender: "support" },
  { id: "change_request_decision", label: "Change approved or declined", audience: "Team", when: "When a customer answers a price we sent.", sender: "noreply" },
  { id: "ticket_team_reminder", label: "Customers waiting on us", audience: "Team", when: "A list of tickets a customer is waiting on us for, once a day at most.", sender: "noreply" },
  { id: "daily_digest", label: "Daily summary", audience: "Team", when: "One email a day with everything we would otherwise have emailed one by one.", sender: "noreply" },
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
    case "login_code": return renderEmail(id, { to, name: "Alex", code: "482 913".replace(" ", ""), minutes: 10 });
    case "password_changed": return renderEmail(id, { to, name: "Alex", when: "2 November 2026, 14:05" });
    case "signing_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", title: "Website for Sample Café", ref: "OSS-OF-2026-047", business: "Sample Café Ltd", signerName: "Alex", signerEmail: to, signedAt: "2 November 2026, 14:05", link: "https://manage.onesimplesite.co.uk/pipeline?stage=won", fileSha: "9f2c1ab07d3e44f1" });
    case "payment_received": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", what: "Website", amount: "£1,200.00", paidOn: "3 November 2026", link: PORTAL });
    case "plan_started": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", amount: "£49.00", link: PORTAL });
    case "payment_failed": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-OF-2026-047", what: "Monthly plan", amount: "£49.00", link: PORTAL });
    case "payment_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", event: "paid", business: "Sample Café Ltd", ref: "OSS-OF-2026-047", what: "Website", amount: "£1,200.00", link: MANAGE });
    case "access_request_decision": return renderEmail(id, { to, name: "Alex Sample", business: "Sample Café Ltd", person: "Sam Colleague", approved: true, note: "", link: PORTAL });
    case "access_request_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", business: "Sample Café Ltd", requester: "Alex Sample", name: "Sam Colleague", email: "sam@example.com", level: "Team member", billing: false, reason: "Sam looks after our bookings.", link: MANAGE });
    case "change_request_quote": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-TK-2026-0002", title: "Add an online booking page", price: "£180.00", note: "Includes setup and testing.", link: PORTAL });
    case "ticket_resolved": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", link: PORTAL });
    case "ticket_reminder": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", days: 3, final: false, link: PORTAL });
    case "change_request_decision": return renderEmail(id, { to: "hello@onesimplesite.co.uk", approved: true, business: "Sample Café Ltd", person: "Alex Sample", ref: "OSS-TK-2026-0002", title: "Add an online booking page", price: "£180.00", link: MANAGE });
    case "ticket_team_reminder": return renderEmail(id, { to: "hello@onesimplesite.co.uk", items: [{ ref: "OSS-TK-2026-0001", business: "Sample Café Ltd", title: "The contact form isn't sending", hours: 30, link: MANAGE }, { ref: "OSS-TK-2026-0004", business: "Quay Plumbing", title: "Change opening hours", hours: 6, link: MANAGE }] });
    case "daily_digest": return renderEmail(id, { to: "hello@onesimplesite.co.uk", day: "2026-11-04", total: 4, groups: [{ title: "Tickets", lines: [{ text: "Alex Sample at Sample Café Ltd raised “The contact form isn't sending” (OSS-TK-2026-0001, high)", link: MANAGE }] }, { title: "Payments", lines: [{ text: "Payment received: Sample Café Ltd, Website £1,200.00", link: MANAGE }, { text: "Plan started: Sample Café Ltd, Monthly plan £49.00", link: MANAGE }] }, { title: "Needs a look", lines: [{ text: "Alex Sample at Sample Café Ltd asked to add Sam Colleague to the portal", link: MANAGE }] }] });
    case "ticket_received": return renderEmail(id, { to, name: "Alex Sample", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", expect: "We reply within one working day.", link: PORTAL });
    case "ticket_reply": return renderEmail(id, { to, name: "Alex Sample", staffName: "Abukar Sharif", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", message: "Thanks Alex. I've found the problem and fixed it. Could you send a test message and let me know it arrives?", link: PORTAL });
    case "ticket_notice": return renderEmail(id, { to: "hello@onesimplesite.co.uk", ref: "OSS-TK-2026-0001", title: "The contact form isn't sending", business: "Sample Café Ltd", person: "Alex Sample", priority: "high", excerpt: "Since yesterday nothing arrives when someone fills in the contact form.", link: MANAGE });
    case "staff_invitation": return renderEmail(id, { to: "new.person@onesimplesite.co.uk", name: "New Person", inviter: "Jamie", roleLabel: "Team member", link: MANAGE, expires: "9 November 2026" });
    case "backup_reminder": return renderEmail(id, { to: "hello@onesimplesite.co.uk", lastBackup: "26 October 2026", link: "https://manage.onesimplesite.co.uk/backup" });
    default: return renderEmail("password_changed", { to, name: "Alex", when: "" });
  }
}
