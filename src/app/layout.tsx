import type { Metadata, Viewport } from "next";
import "./globals.css";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { DevBanner } from "@/components/dev-banner";
import { KeyboardAware } from "@/components/keyboard-aware";

export const metadata: Metadata = { title: { default: "OneSimpleSite Manage", template: process.env.APP_ENV === "staging" ? "[DEV] %s · OneSimpleSite" : "%s · OneSimpleSite" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover", themeColor: "#000000", interactiveWidget: "resizes-content" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB" className={`${GeistSans.variable} ${GeistMono.variable}`}>
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-white">Skip to content</a>
        <DevBanner />
        {children}
        <KeyboardAware />
      </body>
    </html>
  );
}
