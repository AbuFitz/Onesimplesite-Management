import { Html, Head, Body, Container, Img, Preview, Section, Text, Button, Hr, Link } from "@react-email/components";
import type { ReactNode } from "react";
import { portalLink } from "@/lib/env";
import { SITE_URL, SOCIAL_LINKS } from "@/lib/brand-links";

const font = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const ink = "#0E1311", MOSS = "#0C6A49", SPRING = "#4FD9A0", BONE = "#F4F3EE", MINT = "#EAF7F1";

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en-GB">
      <Head><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /></Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: BONE, fontFamily: font, color: ink }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "24px 12px 32px" }}>
          <Section style={{ backgroundColor: "#ffffff", borderRadius: 18, overflow: "hidden", border: "1px solid #e6e7e3" }}>
            {/* Masthead: dark with the template's green aurora where the client supports background images. */}
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: "#0E1311", backgroundImage: `url(${portalLink("/brand/doc/mast-email.jpg")})`, backgroundSize: "cover", backgroundPosition: "center top" }}>
              <tbody><tr><td style={{ padding: "26px 30px 30px" }}>
                <Link href={SITE_URL} style={{ textDecoration: "none" }}>
                  <Img src={portalLink("/brand/wordmark-reversed-colour.png")} width={150} height={24} alt="onesimplesite" style={{ display: "block", fontSize: 20, fontWeight: 700, color: "#EFEBE3" }} />
                </Link>
              </td></tr></tbody>
            </table>
            <div style={{ height: 4, lineHeight: "4px", fontSize: 0, backgroundColor: SPRING }}>&nbsp;</div>
            <div style={{ padding: "30px 30px 8px" }}>{children}</div>
            <div style={{ padding: "8px 30px 26px" }}>
              <Hr style={{ borderColor: "#e6e7e3", margin: "18px 0 14px" }} />
              <Text style={{ fontSize: 13, lineHeight: "20px", color: ink, margin: "0 0 4px", fontWeight: 700 }}>OneSimpleSite</Text>
              <Text style={{ fontSize: 12, lineHeight: "20px", color: "#5b625f", margin: 0 }}>
                <Link href={SITE_URL} style={{ color: MOSS, fontWeight: 600 }}>onesimplesite.co.uk</Link>
                {" · "}<Link href="mailto:hello@onesimplesite.co.uk" style={{ color: "#5b625f" }}>hello@onesimplesite.co.uk</Link>
                {SOCIAL_LINKS.map((l) => (<span key={l.href}>{" · "}<Link href={l.href} style={{ color: "#5b625f" }}>{l.label}</Link></span>))}
              </Text>
            </div>
          </Section>
          <Text style={{ fontSize: 11, lineHeight: "17px", color: "#7a817d", margin: "14px 8px 0", textAlign: "center" }}>You are receiving this because of work with OneSimpleSite. This is a service message, not marketing.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const H = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 26, lineHeight: "32px", fontWeight: 800, letterSpacing: "-0.02em", margin: "0 0 14px", color: ink }}>{children}</Text>;
export const P = ({ children }: { children: ReactNode }) => <Text style={{ fontSize: 16, lineHeight: "24px", margin: "0 0 14px", color: ink }}>{children}</Text>;
export const Action = ({ href, children }: { href: string; children: ReactNode }) => (
  <Section style={{ margin: "22px 0 8px" }}>
    <Button href={href} style={{ backgroundColor: MOSS, color: "#ffffff", fontSize: 16, fontWeight: 700, padding: "14px 26px", borderRadius: 10, textDecoration: "none", display: "inline-block" }}>{children}</Button>
    <Text style={{ fontSize: 12, lineHeight: "18px", color: "#5b625f", margin: "12px 0 0", wordBreak: "break-all" }}>If the button does not work, copy this link into your browser:<br />{href}</Text>
  </Section>
);
export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "8px 0 16px", backgroundColor: MINT, borderRadius: 12 }}>
      <tbody>
        <tr><td style={{ padding: "8px 18px" }}>
          {rows.map(([k, v], n) => (
            <table key={k} width="100%" role="presentation" style={{ borderTop: n ? "1px solid #d3eee2" : "none" }}><tbody><tr>
              <td style={{ padding: "10px 0", fontSize: 13, color: "#3c5a4c", width: "38%", verticalAlign: "top", fontWeight: 600 }}>{k}</td>
              <td style={{ padding: "10px 0", fontSize: 14, color: ink, verticalAlign: "top" }}>{v}</td>
            </tr></tbody></table>
          ))}
        </td></tr>
      </tbody>
    </table>
  );
}
