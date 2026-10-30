import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = { title: { default: "OneSimpleSite Manage", template: "%s · OneSimpleSite" }, robots: { index: false, follow: false } };
export const viewport: Viewport = { width: "device-width", initialScale: 1, viewportFit: "cover" };

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-GB">
      <body>
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:p-3 focus:bg-white">Skip to content</a>
        {children}
      </body>
    </html>
  );
}
