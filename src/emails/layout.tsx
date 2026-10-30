import { Html, Head, Body, Container, Img, Preview, Section, Text, Button, Hr, Link } from "@react-email/components";
import type { ReactNode } from "react";
import { portalLink } from "@/lib/env";
import { SITE_URL, SOCIAL_LINKS } from "@/lib/brand-links";

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const ink = "#0E1311";

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en-GB">
      <Head><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /></Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: "#ffffff", fontFamily: font, color: ink }}>
        <Container style={{ maxWidth: 560, margin: "0 auto", padding: "28px 22px 32px" }}>
          <Link href={SITE_URL} style={{ textDecoration: "none" }}>
            <Img src={portalLink("/brand/wordmark-black.png")} width={150} height={30} alt="onesimplesite" style={{ display: "block", marginBottom: 28, fontSize: 20, fontWeight: 700, color: ink }} />
          </Link>
          {children}
          <Hr style={{ borderColor: "#e4e0d8", margin: "32px 0 16px" }} />
          <Text style={{ fontSize: 13, lineHeight: "20px", color: ink, margin: "0 0 6px", fontWeight: 600 }}>OneSimpleSite</Text>
          <Text style={{ fontSize: 12, lineHeight: "20px", color: "#5b625f", margin: 0 }}>
            <Link href={SITE_URL} style={{ color: "#0C6A49" }}>onesimplesite.co.uk</Link>
            {" · "}<Link href="mailto:hello@onesimplesite.co.uk" style={{ color: "#5b625f" }}>hello@onesimplesite.co.uk</Link>
            {SOCIAL_LINKS.map((l) => (<span key={l.href}>{" · "}<Link href={l.href} style={{ color: "#5b625f" }}>{l.label}</Link></span>))}
            <br />You are receiving this because of work with OneSimpleSite. This is a service message, not marketing.
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export const H = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 22, lineHeight: "28px", fontWeight: 700, margin: "0 0 14px", color: ink }}>{children}</Text>;
export const P = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 16, lineHeight: "24px", margin: "0 0 14px", color: ink }}>{children}</Text>;
export const Action = ({ href, children }: { href: string; children: ReactNode }) => (
  <Section style={{ margin: "22px 0 8px" }}>
    <Button href={href} style={{ backgroundColor: ink, color: "#ffffff", fontSize: 16, fontWeight: 600, padding: "13px 22px", borderRadius: 8, textDecoration: "none", display: "inline-block" }}>{children}</Button>
    <Text style={{ fontSize: 12, lineHeight: "18px", color: "#5b625f", margin: "12px 0 0", wordBreak: "break-all" }}>If the button does not work, copy this link into your browser:<br />{href}</Text>
  </Section>
);
export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <Section style={{ margin: "6px 0 14px", borderTop: "1px solid #e4e0d8" }}>
      {rows.map(([k, v]) => (
        <table key={k} width="100%" role="presentation" style={{ borderBottom: "1px solid #e4e0d8" }}><tbody><tr>
          <td style={{ padding: "9px 0", fontSize: 14, color: "#5b625f", width: "38%", verticalAlign: "top" }}>{k}</td>
          <td style={{ padding: "9px 0", fontSize: 14, color: ink, verticalAlign: "top" }}>{v}</td>
        </tr></tbody></table>
      ))}
    </Section>
  );
}
