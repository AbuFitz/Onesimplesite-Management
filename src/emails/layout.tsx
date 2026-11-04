import { Html, Head, Body, Container, Img, Preview, Section, Text, Button, Hr, Link } from "@react-email/components";
import type { ReactNode } from "react";
import { portalLink } from "@/lib/env";
import { SITE_URL, SOCIAL_LINKS } from "@/lib/brand-links";

// The same two typefaces as the portals: Hanken Grotesk for text and Funnel Display for headings. Apple Mail and most phones load them; Gmail and Outlook fall back to the system font.
const BODY = "'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const DISPLAY = "'Funnel Display', 'Hanken Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif";
const INK = "#0E1311", MOSS = "#0C6A49", SPRING = "#4FD9A0", BONE = "#F1F0EA", MINT = "#EAF7F1", MUTED = "#4d5652", RULE = "#e3e5e0";

// Built when an email is rendered, never when this file loads: the font addresses come from configuration, which does not exist during the build.
const css = () => `
@font-face { font-family: 'Hanken Grotesk'; font-style: normal; font-weight: 100 900; font-display: swap; src: url(${portalLink("/brand/fonts/hanken-grotesk-latin-wght-normal.woff2")}) format('woff2'); }
@font-face { font-family: 'Funnel Display'; font-style: normal; font-weight: 300 800; font-display: swap; src: url(${portalLink("/brand/fonts/funnel-display-latin-wght-normal.woff2")}) format('woff2'); }
a { text-decoration-skip-ink: auto; }
@media (max-width: 480px) { .card-pad { padding-left: 22px !important; padding-right: 22px !important; } }
`;

export function Layout({ preview, children }: { preview: string; children: ReactNode }) {
  return (
    <Html lang="en-GB">
      <Head><meta name="color-scheme" content="light only" /><meta name="supported-color-schemes" content="light only" /><style>{css()}</style></Head>
      <Preview>{preview}</Preview>
      <Body style={{ margin: 0, padding: 0, backgroundColor: BONE, fontFamily: BODY, color: INK }}>
        <Container style={{ maxWidth: 600, margin: "0 auto", padding: "28px 12px 36px" }}>
          <Section style={{ backgroundColor: "#ffffff", borderRadius: 16, overflow: "hidden", border: `1px solid ${RULE}` }}>
            {/* Masthead: dark, with the brand's green aurora where the email app can show background images. */}
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: INK, backgroundImage: `url(${portalLink("/brand/doc/mast-email.jpg")})`, backgroundSize: "cover", backgroundPosition: "center" }}>
              <tbody><tr><td className="card-pad" style={{ padding: "32px 32px 34px" }}>
                <Link href={SITE_URL} style={{ textDecoration: "none" }}>
                  <Img src={portalLink("/brand/wordmark-reversed-colour-email.png")} width={200} height={40} alt="onesimplesite" style={{ display: "block", fontFamily: DISPLAY, fontSize: 20, fontWeight: 700, color: "#EFEBE3" }} />
                </Link>
              </td></tr></tbody>
            </table>
            <div className="card-pad" style={{ padding: "34px 32px 12px" }}>{children}</div>
            <div className="card-pad" style={{ padding: "6px 32px 28px" }}>
              <Hr style={{ borderColor: RULE, margin: "10px 0 0" }} />
            </div>
            {/* Footer band, dark to match the masthead. */}
            <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ backgroundColor: INK }}>
              <tbody><tr><td className="card-pad" style={{ padding: "22px 32px 24px" }}>
                <Text style={{ fontFamily: DISPLAY, fontSize: 15, lineHeight: "20px", color: "#ffffff", margin: "0 0 6px", fontWeight: 700 }}>OneSimpleSite</Text>
                <Text style={{ fontSize: 13, lineHeight: "21px", color: "#c9d1cd", margin: 0 }}>
                  <Link href={SITE_URL} style={{ color: SPRING, fontWeight: 600, textDecoration: "none" }}>onesimplesite.co.uk</Link>
                  {" · "}<Link href="mailto:hello@onesimplesite.co.uk" style={{ color: "#c9d1cd", textDecoration: "none" }}>hello@onesimplesite.co.uk</Link>
                  {SOCIAL_LINKS.map((l) => (<span key={l.href}>{" · "}<Link href={l.href} style={{ color: "#c9d1cd", textDecoration: "none" }}>{l.label}</Link></span>))}
                </Text>
              </td></tr></tbody>
            </table>
          </Section>
          <Text style={{ fontSize: 12, lineHeight: "18px", color: "#68716d", margin: "16px 8px 0", textAlign: "center" }}>You are receiving this because of work with OneSimpleSite. This is a service message, not marketing.</Text>
        </Container>
      </Body>
    </Html>
  );
}

export const H = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: DISPLAY, fontSize: 28, lineHeight: "34px", fontWeight: 700, letterSpacing: "-0.025em", margin: "0 0 16px", color: INK }}>{children}</Text>;
export const P = ({ children }: { children: ReactNode }) => <Text style={{ fontFamily: BODY, fontSize: 16, lineHeight: "25px", margin: "0 0 16px", color: "#1d2421" }}>{children}</Text>;
export const Action = ({ href, children }: { href: string; children: ReactNode }) => (
  <Section style={{ margin: "26px 0 10px" }}>
    <Button href={href} style={{ backgroundColor: MOSS, color: "#ffffff", fontFamily: BODY, fontSize: 16, fontWeight: 700, padding: "15px 28px", borderRadius: 8, textDecoration: "none", display: "inline-block", letterSpacing: "-0.005em" }}>{children}</Button>
    <Text style={{ fontSize: 12, lineHeight: "18px", color: MUTED, margin: "14px 0 0", wordBreak: "break-all" }}>If the button doesn't work, copy this link into your browser:<br /><Link href={href} style={{ color: MOSS }}>{href}</Link></Text>
  </Section>
);
export function Facts({ rows }: { rows: [string, string][] }) {
  return (
    <table role="presentation" width="100%" cellPadding={0} cellSpacing={0} style={{ margin: "10px 0 20px", backgroundColor: MINT, borderRadius: 10, borderLeft: `4px solid ${MOSS}` }}>
      <tbody>
        <tr><td style={{ padding: "6px 20px" }}>
          {rows.map(([k, v], n) => (
            <table key={k} width="100%" role="presentation" cellPadding={0} cellSpacing={0} style={{ borderTop: n ? "1px solid #cfe9dd" : "none" }}><tbody><tr>
              <td style={{ padding: "11px 0", fontFamily: BODY, fontSize: 13, color: "#2c4a3c", width: "36%", verticalAlign: "top", fontWeight: 700 }}>{k}</td>
              <td style={{ padding: "11px 0", fontFamily: BODY, fontSize: 15, color: INK, verticalAlign: "top", fontWeight: 500 }}>{v}</td>
            </tr></tbody></table>
          ))}
        </td></tr>
      </tbody>
    </table>
  );
}
