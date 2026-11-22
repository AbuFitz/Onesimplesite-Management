import { ImageResponse } from "next/og";
import { findByCode } from "@/modules/referrals/service";

export const alt = "A recommendation from a OneSimpleSite customer";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/** The card that shows when the link is pasted into WhatsApp, iMessage, LinkedIn or X. */
export default async function Image({ params }: { params: Promise<{ code: string }> }) {
  const hit = await findByCode((await params).code).catch(() => null);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", justifyContent: "space-between", padding: 72, background: "linear-gradient(135deg,#0f1a08,#1f3a12 55%,#2f7a4e)", color: "#fff", fontFamily: "sans-serif" }}>
        <div style={{ display: "flex", fontSize: 44, fontWeight: 700, letterSpacing: -1 }}>one<span style={{ color: "#8fd14f" }}>simple</span>site</div>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", fontSize: 30, opacity: 0.75 }}>A recommendation</div>
          <div style={{ display: "flex", fontSize: 84, fontWeight: 700, lineHeight: 1.05, letterSpacing: -2, marginTop: 12 }}>{hit ? `${hit.name} recommends us` : "Your website, made simple"}</div>
        </div>
        <div style={{ display: "flex", fontSize: 30, opacity: 0.85 }}>Simple, good-looking websites for small businesses</div>
      </div>
    ),
    size,
  );
}
