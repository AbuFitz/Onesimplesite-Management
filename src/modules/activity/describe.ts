/** Turns a recorded event (action name) into a sentence a person reads, with the group it belongs to. One place, so every timeline says the same thing. */
export type Group = "agreement" | "money" | "ticket" | "people" | "security" | "company" | "project";
type D = { text: string; group: Group; tone?: "good" | "warn" | "bad" };

const MAP: Record<string, D> = {
  "proposal.created": { text: "Agreement started", group: "agreement" }, "proposal.sent": { text: "Agreement sent for signature", group: "agreement" }, "proposal.revised": { text: "A new version of the agreement was made", group: "agreement" }, "proposal.accepted": { text: "Agreement accepted", group: "agreement", tone: "good" },
  "agreement.sent": { text: "Agreement sent for signature", group: "agreement" }, "contract.sent": { text: "Signing link sent to the customer", group: "agreement" }, "contract.reissued": { text: "A fresh signing link was sent", group: "agreement" },
  "signing.viewed": { text: "The customer opened the agreement", group: "agreement" },
  "contract.signed": { text: "Agreement signed", group: "agreement", tone: "good" }, "contract.declined": { text: "Agreement declined", group: "agreement", tone: "bad" }, "contract.voided": { text: "Agreement withdrawn", group: "agreement", tone: "warn" }, "contract.cancelled": { text: "Agreement cancelled", group: "agreement", tone: "bad" },
  "contract.completion_recorded": { text: "Completion recorded", group: "agreement", tone: "good" }, "contract.pdf_downloaded": { text: "Signed PDF downloaded by the team", group: "agreement" }, "contract.pdf_downloaded_by_client": { text: "Signed PDF downloaded by the customer", group: "agreement" },
  "billing.split": { text: "Payment split into deposit and final payment", group: "money" }, "billing.plan_opened": { text: "Care plan opened", group: "money" }, "billing.plan_cancel_requested": { text: "Care plan cancellation requested", group: "money", tone: "warn" },
  "billing.paid_manually": { text: "Payment recorded by hand", group: "money", tone: "good" }, "billing.offer_set": { text: "Offer applied", group: "money" }, "billing.link_emailed": { text: "Payment link emailed", group: "money" },
  "billing.free_plan_started": { text: "Free care period started", group: "money" }, "billing.free_plan_continued": { text: "Care plan continued after the free period", group: "money", tone: "good" }, "billing.final_payment_requested": { text: "Final payment requested", group: "money" }, "billing.cancelled": { text: "Charge cancelled", group: "money", tone: "bad" },
  "ticket.created": { text: "Ticket raised", group: "ticket" }, "ticket.updated": { text: "Ticket updated", group: "ticket" }, "ticket.change_quoted": { text: "Price sent for approval", group: "ticket" }, "ticket.change_included": { text: "Change covered by the plan", group: "ticket" }, "ticket.change_approved": { text: "Price approved", group: "ticket", tone: "good" }, "ticket.change_declined": { text: "Price declined", group: "ticket", tone: "bad" },
  "person.added": { text: "Person added", group: "people" }, "person.updated": { text: "Person updated", group: "people" }, "person.removed": { text: "Person removed", group: "people", tone: "warn" }, "person.made_main_contact": { text: "Main contact changed", group: "people" },
  "person.access_changed": { text: "Portal access changed", group: "people" }, "person.access_removed": { text: "Portal access removed", group: "people", tone: "warn" }, "person.password_reset_sent": { text: "Password reset email sent", group: "people" },
  "client.invited": { text: "Invited to the portal", group: "people" }, "access.requested": { text: "Asked to add someone to the portal", group: "people" }, "access.approved": { text: "Portal request approved", group: "people", tone: "good" }, "access.declined": { text: "Portal request declined", group: "people", tone: "bad" },
  "security.two_step_reset": { text: "Two-step sign-in reset", group: "security", tone: "warn" },
  "company.registered": { text: "Company added", group: "company" }, "company.deleted": { text: "Company deleted", group: "company", tone: "bad" }, "customer.status_changed": { text: "Status changed", group: "company" }, "customer.details_updated": { text: "Company details updated", group: "company" }, "lead.created": { text: "Enquiry received", group: "company" }, "opportunity.stage": { text: "Sales stage changed", group: "company" },
  "project.stage": { text: "Project moved to a new stage", group: "project" }, "project.type": { text: "Project type changed", group: "project" }, "project.files_added": { text: "Files added to the project", group: "project" }, "project.client_sent": { text: "Sent to the customer", group: "project" },
};

export function describe(action: string): D {
  return MAP[action] ?? { text: action.replaceAll(".", " ").replaceAll("_", " ").replace(/^./, (c) => c.toUpperCase()), group: "company" };
}
