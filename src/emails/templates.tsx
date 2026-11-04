import { render, Text } from "@react-email/components";
import type { ReactNode } from "react";
import { Layout, H, P, Action, Facts } from "./layout";

export const TEMPLATE_VERSION = "2026-10-v1";

export type EmailData = {
  proposal: { to: string; ref: string; title: string; version: number; link: string; validUntil: string; oneOff: string; recurring?: string };
  contract_request: { to: string; signerName: string; title: string; ref: string; link: string; expires: string; business: string };
  signing_confirmation: { to: string; signerName: string; title: string; ref: string; signedAt: string; fileSha: string; hasAttachment: boolean };
  signing_notice: { to: string; title: string; ref: string; business: string; signerName: string; signerEmail: string; signedAt: string; link: string; fileSha: string };
  invitation: { to: string; businessName: string; inviter: string; link: string; expires: string };
  password_reset: { to: string; name: string; link: string; minutes: number };
  password_changed: { to: string; name: string; when: string };
  backup_reminder: { to: string; lastBackup: string; link: string };
  staff_invitation: { to: string; name: string; inviter: string; roleLabel: string; link: string; expires: string };
  payment_received: { to: string; name: string; ref: string; what: string; amount: string; paidOn: string; link: string; receiptRef?: string; receiptId?: string };
  plan_started: { to: string; name: string; ref: string; amount: string; link: string; receiptRef?: string; receiptId?: string };
  payment_failed: { to: string; name: string; ref: string; what: string; amount: string; link: string };
  payment_notice: { to: string; event: "paid" | "plan_started" | "failed" | "cancelled"; business: string; ref: string; what: string; amount: string; link: string };
  access_request_notice: { to: string; business: string; requester: string; name: string; email: string; level: string; billing: boolean; reason: string; link: string };
  access_request_decision: { to: string; name: string; business: string; person: string; approved: boolean; note: string; link: string };
  change_request_quote: { to: string; name: string; ref: string; title: string; price: string; note: string; link: string };
  change_request_decision: { to: string; approved: boolean; business: string; person: string; ref: string; title: string; price: string; link: string };
  ticket_resolved: { to: string; name: string; ref: string; title: string; link: string };
  ticket_reminder: { to: string; name: string; ref: string; title: string; days: number; final: boolean; link: string };
  ticket_team_reminder: { to: string; items: { ref: string; business: string; title: string; hours: number; link: string }[] };
  daily_digest: { to: string; day: string; total: number; groups: { title: string; lines: { text: string; link?: string }[] }[] };
  ticket_received: { to: string; name: string; ref: string; title: string; expect: string; link: string };
  ticket_notice: { to: string; ref: string; title: string; business: string; person: string; priority: string; excerpt: string; link: string; isReply?: boolean };
  ticket_reply: { to: string; name: string; staffName: string; ref: string; title: string; message: string; link: string };
};
export type TemplateName = keyof EmailData;

type Built = { subject: string; node: ReactNode; text: string };

const builders: { [K in TemplateName]: (d: EmailData[K]) => Built } = {
  proposal: (d) => ({
    subject: `Proposal ${d.ref}: ${d.title}`,
    node: (
      <Layout preview={`Your proposal “${d.title}” is ready to review`}>
        <H>Your proposal is ready</H>
        <P>Please review “{d.title}”. You can accept it online once you have read it.</P>
        <Facts rows={[["Reference", `${d.ref} · version ${d.version}`], ["One-off", d.oneOff], ...(d.recurring ? ([["Recurring", d.recurring]] as [string, string][]) : []), ["Valid until", d.validUntil]]} />
        <Action href={d.link}>Review proposal</Action>
        <P>The link is personal to you. If it stops working, reply to this email and we will send a new one.</P>
      </Layout>
    ),
    text: `Your proposal is ready\n\nPlease review "${d.title}" (${d.ref}, version ${d.version}).\nOne-off: ${d.oneOff}${d.recurring ? `\nRecurring: ${d.recurring}` : ""}\nValid until: ${d.validUntil}\n\nReview proposal: ${d.link}\n\nThe link is personal to you. If it stops working, reply to this email and we will send a new one.\n\nOneSimpleSite`,
  }),
  payment_received: (d) => ({
    subject: `Payment received: ${d.what} (${d.ref})`,
    node: (
      <Layout preview={`Thank you ${d.name.split(" ")[0]}. We've received ${d.amount}.`}>
        <H>Payment received. Thank you!</H>
        <P>Hi {d.name.split(" ")[0]}, we've received your payment. Nothing more to do on this one.</P>
        <Facts rows={[["For", d.what], ["Amount", d.amount], ["Paid on", d.paidOn], ["Order", d.ref], ...(d.receiptRef ? ([["Receipt", d.receiptRef]] as [string, string][]) : [])]} />
        <Action href={d.link}>See your payments</Action>
        <P>{d.receiptRef ? "Your receipt is attached, and it's saved on your Billing page whenever you need it. " : ""}If anything looks wrong, just reply to this email.</P>
      </Layout>
    ),
    text: `Payment received. Thank you!\n\nHi ${d.name.split(" ")[0]}, we've received ${d.amount} for ${d.what} (${d.ref}) on ${d.paidOn}.${d.receiptRef ? ` Receipt ${d.receiptRef} is attached and saved on your Billing page.` : ""} Nothing more to do on this one.\n\nSee your payments: ${d.link}`,
  }),
  plan_started: (d) => ({
    subject: `Your monthly plan is live (${d.ref})`,
    node: (
      <Layout preview={`Your plan is set up at ${d.amount} a month.`}>
        <H>Your monthly plan is live</H>
        <P>Hi {d.name.split(" ")[0]}, your first payment went through and your plan is now active. It renews every month and you can change your card or cancel from the Billing page.</P>
        <Facts rows={[["Plan price", `${d.amount} a month`], ["Order", d.ref]]} />
        <Action href={d.link}>Manage your plan</Action>
      </Layout>
    ),
    text: `Your monthly plan is live\n\nHi ${d.name.split(" ")[0]}, your plan (${d.amount} a month, order ${d.ref}) is now active. Manage it any time: ${d.link}`,
  }),
  payment_failed: (d) => ({
    subject: `We couldn't take your payment (${d.ref})`,
    node: (
      <Layout preview={`Your ${d.amount} payment didn't go through.`}>
        <H>Your payment didn't go through</H>
        <P>Hi {d.name.split(" ")[0]}, we tried to take {d.amount} for {d.what} but your bank or card declined it. This happens a lot and is usually quick to fix. Please update your card and Stripe will try again.</P>
        <Action href={d.link}>Update your card</Action>
        <P>Need a hand? Just reply to this email.</P>
      </Layout>
    ),
    text: `Your payment didn't go through\n\nHi ${d.name.split(" ")[0]}, we couldn't take ${d.amount} for ${d.what} (${d.ref}). Please update your card: ${d.link}`,
  }),
  payment_notice: (d) => {
    const head = { paid: "Payment received", plan_started: "Monthly plan started", failed: "Payment failed", cancelled: "Monthly plan cancelled" }[d.event];
    return {
      subject: `${head}: ${d.business} · ${d.ref}`,
      node: (
        <Layout preview={`${head}: ${d.business}, ${d.amount}`}>
          <H>{head}</H>
          <P>{d.business}: {d.what}.</P>
          <Facts rows={[["Order", d.ref], ["Amount", d.amount]]} />
          <Action href={d.link}>Open order</Action>
        </Layout>
      ),
      text: `${head}: ${d.business}\n${d.what} (${d.ref}) ${d.amount}\n\nOpen: ${d.link}`,
    };
  },
  access_request_notice: (d) => ({
    subject: `Portal access request: ${d.business}`,
    node: (
      <Layout preview={`${d.requester} asked for ${d.name} to get portal access`}>
        <H>New portal access request</H>
        <P>{d.requester} at {d.business} has asked for another person to get access to their client portal. Check it is genuine, then approve or decline.</P>
        <Facts rows={[["Person", `${d.name} (${d.email})`], ["Access", `${d.level}${d.billing ? " + billing" : ""}`], ["Why", d.reason || "Not given"]]} />
        <Action href={d.link}>Review request</Action>
      </Layout>
    ),
    text: `Portal access request from ${d.requester} at ${d.business}\n${d.name} (${d.email})\nAccess: ${d.level}${d.billing ? " + billing" : ""}\nWhy: ${d.reason || "Not given"}\n\nReview: ${d.link}`,
  }),
  access_request_decision: (d) => ({
    subject: d.approved ? `${d.person} now has portal access` : `About your request for ${d.person}`,
    node: (
      <Layout preview={d.approved ? `${d.person} has been invited` : `We couldn't add ${d.person} yet`}>
        <H>{d.approved ? "They're in" : "We couldn't add them yet"}</H>
        <P>Hi {d.name.split(" ")[0]}, {d.approved ? `we've sent ${d.person} an invitation to join ${d.business}'s portal. They'll get an email with a link to set a password.` : `we weren't able to give ${d.person} access to ${d.business}'s portal${d.note ? `: ${d.note}` : "."} If you think that's a mistake, reply to this email.`}</P>
        <Action href={d.link}>Open your portal</Action>
      </Layout>
    ),
    text: `${d.approved ? `${d.person} has been invited to ${d.business}'s portal.` : `We couldn't give ${d.person} access to ${d.business}'s portal${d.note ? `: ${d.note}` : "."}`}\n\n${d.link}`,
  }),
  change_request_quote: (d) => ({
    subject: `Please approve: ${d.title} (${d.price})`,
    node: (
      <Layout preview={`${d.title} will cost ${d.price}. Approve it to get started.`}>
        <H>Your change is priced</H>
        <P>Hi {d.name.split(" ")[0]}, this is outside what your plan covers, so there's a one-off cost. Nothing starts until you say yes.</P>
        <Facts rows={[["Change", d.title], ["Cost", d.price], ["Ticket", d.ref], ...(d.note ? ([["Note", d.note]] as [string, string][]) : [])]} />
        <Action href={d.link}>Review and approve</Action>
        <P>You can pay securely by card once you've approved. Reply to this email if you'd like to talk it through first.</P>
      </Layout>
    ),
    text: `Your change is priced\n\nHi ${d.name.split(" ")[0]}, "${d.title}" (${d.ref}) will cost ${d.price}${d.note ? `. ${d.note}` : ""}.\nNothing starts until you approve it: ${d.link}`,
  }),
  change_request_decision: (d) => ({
    subject: `${d.approved ? "Approved" : "Declined"}: ${d.business} · ${d.ref}`,
    node: (
      <Layout preview={`${d.person} ${d.approved ? "approved" : "declined"} ${d.price}`}>
        <H>{d.approved ? "Change approved" : "Change declined"}</H>
        <P>{d.person} at {d.business} {d.approved ? "approved the price. You can start, and the payment is on their Billing page." : "isn't going ahead at this price. Have a look at their note."}</P>
        <Facts rows={[["Ticket", `${d.ref} · ${d.title}`], ["Cost", d.price]]} />
        <Action href={d.link}>Open ticket</Action>
      </Layout>
    ),
    text: `${d.approved ? "Approved" : "Declined"}: ${d.person} at ${d.business}\n${d.ref} ${d.title} (${d.price})\n\nOpen: ${d.link}`,
  }),
  ticket_resolved: (d) => ({
    subject: `Sorted: ${d.title} (${d.ref})`,
    node: (
      <Layout preview={`We've marked ${d.ref} as sorted`}>
        <H>This one's sorted</H>
        <P>Hi {d.name.split(" ")[0]}, we've marked “{d.title}” as done. If it still isn't right, just reply on the ticket and it comes straight back to us.</P>
        <Action href={d.link}>See the ticket</Action>
      </Layout>
    ),
    text: `Sorted: ${d.title} (${d.ref})\n\nHi ${d.name.split(" ")[0]}, we've marked this as done. If it's still not right, reply here: ${d.link}`,
  }),
  ticket_reminder: (d) => ({
    subject: d.final ? `Last reminder: ${d.title} (${d.ref})` : `Still need a hand? ${d.title} (${d.ref})`,
    node: (
      <Layout preview={d.final ? "We'll close this soon unless we hear from you" : "We're waiting to hear from you"}>
        <H>{d.final ? "We'll close this soon" : "We're waiting to hear from you"}</H>
        <P>Hi {d.name.split(" ")[0]}, we replied on “{d.title}” {d.days} days ago and haven't heard back. {d.final ? "We'll mark it as sorted in a few days unless you reply. You can always reopen it by replying." : "Whenever you're ready, you can answer on the ticket."}</P>
        <Action href={d.link}>Reply on the ticket</Action>
      </Layout>
    ),
    text: `${d.final ? "We'll close this soon" : "We're waiting to hear from you"}\n\n"${d.title}" (${d.ref}) - we replied ${d.days} days ago.\nReply here: ${d.link}`,
  }),
  ticket_team_reminder: (d) => ({
    subject: `${d.items.length} ticket${d.items.length === 1 ? "" : "s"} waiting on us`,
    node: (
      <Layout preview={`${d.items.length} customer${d.items.length === 1 ? " is" : "s are"} waiting for a reply`}>
        <H>Waiting on us</H>
        <P>These customers are waiting for a reply, longest first.</P>
        <Facts rows={d.items.map((i) => [`${i.business} · ${i.ref}`, `${i.title} (waiting ${i.hours < 48 ? `${i.hours}h` : `${Math.round(i.hours / 24)} days`})`] as [string, string])} />
        <Action href={d.items[0]?.link ?? "#"}>Open the longest wait</Action>
      </Layout>
    ),
    text: `Waiting on us\n\n${d.items.map((i) => `${i.business} ${i.ref}: ${i.title} (${i.hours}h) ${i.link}`).join("\n")}`,
  }),
  daily_digest: (d) => ({
    subject: `Your daily summary: ${d.total} ${d.total === 1 ? "thing" : "things"}`,
    node: (
      <Layout preview={`${d.total} updates from the last day`}>
        <H>Your daily summary</H>
        <P>Everything the team was told about since the last summary, in one place. The same items are in the app.</P>
        {d.groups.map((g) => (
          <div key={g.title}><P><strong>{g.title}</strong></P>{g.lines.map((l, i) => <P key={i}>{l.link ? <a href={l.link} style={{ color: "#0c6a49" }}>{l.text}</a> : l.text}</P>)}</div>
        ))}
      </Layout>
    ),
    text: `Your daily summary (${d.total})\n\n${d.groups.map((g) => `${g.title}\n${g.lines.map((l) => `- ${l.text}${l.link ? ` ${l.link}` : ""}`).join("\n")}`).join("\n\n")}`,
  }),
  ticket_received: (d) => ({
    subject: `We've got your ticket: ${d.title} (${d.ref})`,
    node: (
      <Layout preview={`Thanks ${d.name.split(" ")[0]}, we're on it. ${d.ref}`}>
        <H>We've got it, {d.name.split(" ")[0]}</H>
        <P>Thanks for letting us know. Your ticket is in and someone on the team will pick it up. {d.expect}</P>
        <Facts rows={[["Ticket", d.ref], ["About", d.title]]} />
        <Action href={d.link}>See your ticket</Action>
        <P>You can add more details there at any time, and you'll see our replies in the same place.</P>
      </Layout>
    ),
    text: `We've got it, ${d.name.split(" ")[0]}\n\nYour ticket ${d.ref} ("${d.title}") is in. ${d.expect}\n\nSee your ticket: ${d.link}`,
  }),
  ticket_notice: (d) => ({
    subject: `${d.isReply ? "Customer reply" : "New ticket"}: ${d.business} · ${d.ref}${d.priority === "urgent" ? " · URGENT" : ""}`,
    node: (
      <Layout preview={`${d.person} at ${d.business}: ${d.title}`}>
        <H>{d.isReply ? "Customer replied" : "New support ticket"}</H>
        <P>{d.person} at {d.business} {d.isReply ? "replied on" : "raised"} “{d.title}”.</P>
        <Facts rows={[["Ticket", d.ref], ["Priority", d.priority], ["Message", d.excerpt]]} />
        <Action href={d.link}>Open ticket</Action>
      </Layout>
    ),
    text: `${d.isReply ? "Customer reply" : "New ticket"} ${d.ref} from ${d.person} at ${d.business}\nPriority: ${d.priority}\n\n${d.excerpt}\n\nOpen: ${d.link}`,
  }),
  ticket_reply: (d) => ({
    subject: `Re: ${d.title} (${d.ref})`,
    node: (
      <Layout preview={`${d.staffName} replied to your ticket`}>
        <H>{d.staffName.split(" ")[0]} replied</H>
        <P>Hi {d.name.split(" ")[0]},</P>
        <Text style={{ fontSize: 16, lineHeight: "24px", margin: "0 0 14px", whiteSpace: "pre-wrap", backgroundColor: "#EAF7F1", borderRadius: 12, padding: "14px 16px" }}>{d.message}</Text>
        <Action href={d.link}>Reply in your portal</Action>
        <P>Ticket {d.ref}. You can also just reply to this email.</P>
      </Layout>
    ),
    text: `Hi ${d.name.split(" ")[0]},\n\n${d.message}\n\nReply in your portal: ${d.link}\nTicket ${d.ref}. You can also just reply to this email.`,
  }),
  contract_request: (d) => ({
    subject: `Please review and sign: ${d.title}`,
    node: (
      <Layout preview={`${d.business} · your order is ready to review and sign`}>
        <H>Your order is ready to sign</H>
        <P>Hi {d.signerName}, your order form is ready. Read it through and sign online. It takes about two minutes and works on a phone.</P>
        <Facts rows={[["Order", d.title], ["Reference", d.ref], ["For", d.business], ["Sign by", d.expires]]} />
        <Action href={d.link}>Review and sign</Action>
        <P>Please do not forward this link, as anyone who has it can sign. Not expecting this? Just reply and tell us.</P>
      </Layout>
    ),
    text: `Your order is ready to sign\n\nHi ${d.signerName},\n\nYour order form "${d.title}" (${d.ref}) for ${d.business} is ready for you to read and sign online.\nSign by: ${d.expires}\n\nReview and sign: ${d.link}\n\nAnyone with this link can sign, so please do not forward it. If you were not expecting this, reply and tell us.\n\nOneSimpleSite Contracts`,
  }),
  signing_confirmation: (d) => ({
    subject: `Signed: ${d.title}`,
    node: (
      <Layout preview={`Thank you. ${d.title} is signed and recorded`}>
        <H>Thank you, you are all signed</H>
        <P>Hello {d.signerName}, we have recorded your signature on “{d.title}”. {d.hasAttachment ? "A copy of the signed order is attached." : "A copy is available from us on request."}</P>
        <Facts rows={[["Order", d.title], ["Reference", d.ref], ["Signed", d.signedAt], ["File fingerprint (SHA-256)", d.fileSha.slice(0, 16) + "…"]]} />
        <P>Next, we will be in touch about getting started. Please keep this email for your records.</P>
      </Layout>
    ),
    text: `Thank you, it is signed\n\nHello ${d.signerName},\n\nWe have recorded your signature on "${d.title}" (${d.ref}) at ${d.signedAt}. ${d.hasAttachment ? "A copy of the signed order is attached." : ""}\nFile fingerprint (SHA-256): ${d.fileSha}\n\nNext, we will be in touch about getting started. Please keep this email for your records.\n\nOneSimpleSite Contracts`,
  }),
  signing_notice: (d) => ({
    subject: `New signature: ${d.business} · ${d.ref}`,
    node: (
      <Layout preview={`${d.signerName} signed ${d.title}`}>
        <H>Signed: {d.business}</H>
        <P>{d.signerName} has signed “{d.title}” for {d.business}. The project has been created.</P>
        <Facts rows={[["Reference", d.ref], ["Signer", `${d.signerName} (${d.signerEmail})`], ["Signed", d.signedAt], ["SHA-256", d.fileSha]]} />
        <Action href={d.link}>Open in Manage</Action>
        <P>Signature capture confirms the emailed link was used. It does not verify identity.</P>
      </Layout>
    ),
    text: `Contract signed\n\n${d.signerName} (${d.signerEmail}) signed "${d.title}" for ${d.business}.\nReference: ${d.ref}\nSigned: ${d.signedAt}\nSHA-256: ${d.fileSha}\n\nOpen contract: ${d.link}\n\nSignature capture confirms the emailed link was used. It does not verify identity.`,
  }),
  invitation: (d) => ({
    subject: `${d.inviter} invited you to the OneSimpleSite client portal`,
    node: (
      <Layout preview={`Set up access for ${d.businessName}`}>
        <H>Set up your portal access</H>
        <P>{d.inviter} has invited you to the OneSimpleSite Client Portal for {d.businessName}. You can follow project progress and find your documents there.</P>
        <Action href={d.link}>Set up access</Action>
        <P>This invitation can be used once and expires on {d.expires}.</P>
      </Layout>
    ),
    text: `Set up your portal access\n\n${d.inviter} has invited you to the OneSimpleSite Client Portal for ${d.businessName}.\n\nSet up access: ${d.link}\n\nThis invitation can be used once and expires on ${d.expires}.\n\nOneSimpleSite`,
  }),
  password_reset: (d) => ({
    subject: "Reset your OneSimpleSite password",
    node: (
      <Layout preview="Use this link to choose a new password">
        <H>Reset your password</H>
        <P>Hello {d.name}, we received a request to reset your password. Choose a new one with the button below.</P>
        <Action href={d.link}>Choose a new password</Action>
        <P>This link works once and expires in {d.minutes} minutes. If you did not ask for this, ignore this email and your password stays the same.</P>
      </Layout>
    ),
    text: `Reset your password\n\nHello ${d.name},\n\nChoose a new password: ${d.link}\n\nThis link works once and expires in ${d.minutes} minutes. If you did not ask for this, ignore this email and your password stays the same.\n\nOneSimpleSite`,
  }),
  password_changed: (d) => ({
    subject: "Your OneSimpleSite password was changed",
    node: (
      <Layout preview="Your password was just changed">
        <H>Your password was changed</H>
        <P>Hello {d.name}, your OneSimpleSite password was changed on {d.when}.</P>
        <P>If this was you, there is nothing to do. If it was not, reply to this email straight away and we will lock the account.</P>
      </Layout>
    ),
    text: `Your password was changed\n\nHello ${d.name},\n\nYour OneSimpleSite password was changed on ${d.when}.\n\nIf this was you, there is nothing to do. If it was not, reply to this email straight away and we will lock the account.\n\nOneSimpleSite`,
  }),
  backup_reminder: (d) => ({
    subject: "Weekly backup due: OneSimpleSite Manage",
    node: (
      <Layout preview="Time to download this week's backup">
        <H>Your weekly backup is due</H>
        <P>The last backup was {d.lastBackup}. Please download a fresh copy and store it somewhere private.</P>
        <Action href={d.link}>Go to Backup</Action>
        <P>This reminder repeats weekly until a backup is taken.</P>
      </Layout>
    ),
    text: `Your weekly backup is due\n\nThe last backup was ${d.lastBackup}. Please download a fresh copy and store it somewhere private.\n\nGo to Backup: ${d.link}\n\nThis reminder repeats weekly until a backup is taken.\n\nOneSimpleSite`,
  }),
  staff_invitation: (d) => ({
    subject: `${d.inviter} added you to OneSimpleSite Manage`,
    node: (
      <Layout preview={`Set up your login as ${d.roleLabel}`}>
        <H>Set up your login</H>
        <P>Hello {d.name}, {d.inviter} has added you to OneSimpleSite Manage as {d.roleLabel}. Choose a password to get started.</P>
        <Action href={d.link}>Set up my login</Action>
        <P>This link works once and expires on {d.expires}. You can change your password any time from My account.</P>
      </Layout>
    ),
    text: `Set up your login\n\nHello ${d.name},\n\n${d.inviter} has added you to OneSimpleSite Manage as ${d.roleLabel}.\n\nSet up my login: ${d.link}\n\nThis link works once and expires on ${d.expires}.\n\nOneSimpleSite`,
  }),
};

export async function renderEmail<K extends TemplateName>(name: K, data: EmailData[K]) {
  const b = (builders[name] as (d: EmailData[K]) => Built)(data);
  return { subject: b.subject, html: await render(b.node), text: b.text, version: TEMPLATE_VERSION };
}
