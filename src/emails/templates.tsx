import { render } from "@react-email/components";
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
  staff_invitation: { to: string; name: string; inviter: string; roleLabel: string; link: string; expires: string };
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
  contract_request: (d) => ({
    subject: `Please review and sign: ${d.title}`,
    node: (
      <Layout preview={`${d.business} · agreement ready to review and sign`}>
        <H>Your agreement is ready to sign</H>
        <P>Hello {d.signerName}, the agreement named below is ready for you to read and sign online. It takes a couple of minutes and works on a phone.</P>
        <Facts rows={[["Agreement", d.title], ["Reference", d.ref], ["For", d.business], ["Sign by", d.expires]]} />
        <Action href={d.link}>Review and sign</Action>
        <P>Anyone with this link can sign, so please do not forward it. If you were not expecting this, reply and tell us.</P>
      </Layout>
    ),
    text: `Your agreement is ready to sign\n\nHello ${d.signerName},\n\nThe agreement "${d.title}" (${d.ref}) for ${d.business} is ready for you to read and sign online.\nSign by: ${d.expires}\n\nReview and sign: ${d.link}\n\nAnyone with this link can sign, so please do not forward it. If you were not expecting this, reply and tell us.\n\nOneSimpleSite Contracts`,
  }),
  signing_confirmation: (d) => ({
    subject: `Signed: ${d.title}`,
    node: (
      <Layout preview={`Thank you. ${d.title} is signed and recorded`}>
        <H>Thank you, it is signed</H>
        <P>Hello {d.signerName}, we have recorded your signature on “{d.title}”. {d.hasAttachment ? "A copy of the signed agreement is attached." : "A copy is available from us on request."}</P>
        <Facts rows={[["Agreement", d.title], ["Reference", d.ref], ["Signed", d.signedAt], ["File fingerprint (SHA-256)", d.fileSha.slice(0, 16) + "…"]]} />
        <P>Next, your project owner will be in touch about getting started. Please keep this email for your records.</P>
      </Layout>
    ),
    text: `Thank you, it is signed\n\nHello ${d.signerName},\n\nWe have recorded your signature on "${d.title}" (${d.ref}) at ${d.signedAt}. ${d.hasAttachment ? "A copy of the signed agreement is attached." : ""}\nFile fingerprint (SHA-256): ${d.fileSha}\n\nNext, your project owner will be in touch about getting started. Please keep this email for your records.\n\nOneSimpleSite Contracts`,
  }),
  signing_notice: (d) => ({
    subject: `Contract signed: ${d.business} · ${d.ref}`,
    node: (
      <Layout preview={`${d.signerName} signed ${d.title}`}>
        <H>Contract signed</H>
        <P>{d.signerName} has signed “{d.title}” for {d.business}. The project and billing intentions have been created.</P>
        <Facts rows={[["Reference", d.ref], ["Signer", `${d.signerName} (${d.signerEmail})`], ["Signed", d.signedAt], ["SHA-256", d.fileSha]]} />
        <Action href={d.link}>Open contract</Action>
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
