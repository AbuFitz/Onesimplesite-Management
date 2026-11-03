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
  payment_received: { to: string; name: string; ref: string; what: string; amount: string; paidOn: string; link: string };
  plan_started: { to: string; name: string; ref: string; amount: string; link: string };
  payment_failed: { to: string; name: string; ref: string; what: string; amount: string; link: string };
  payment_notice: { to: string; event: "paid" | "plan_started" | "failed" | "cancelled"; business: string; ref: string; what: string; amount: string; link: string };
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
        <Facts rows={[["For", d.what], ["Amount", d.amount], ["Paid on", d.paidOn], ["Order", d.ref]]} />
        <Action href={d.link}>See your payments</Action>
        <P>Stripe may also email you a card receipt. If anything looks wrong, just reply to this email.</P>
      </Layout>
    ),
    text: `Payment received. Thank you!\n\nHi ${d.name.split(" ")[0]}, we've received ${d.amount} for ${d.what} (${d.ref}) on ${d.paidOn}. Nothing more to do on this one.\n\nSee your payments: ${d.link}`,
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
