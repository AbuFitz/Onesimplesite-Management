import type { AccountItem } from "@/components/account-nav";
export const portalItems = (s: { twoStep: boolean; companies: number }): AccountItem[] => [
  { href: "/account/details", label: "Your details", note: "Name, email, phone, role", icon: "profile", tint: "#4a6024" },
  { href: "/account/companies", label: s.companies > 1 ? "Your companies" : "Your company", note: "Your access level", icon: "companies", tint: "#3b6ea5" },
  { href: "/account/password", label: "Password", note: "Change it any time", icon: "password", tint: "#b7791f" },
  { href: "/account/security", label: "Two-step sign-in", note: "Authenticator app, passkeys, devices", icon: "security", tint: "#161d0b", status: s.twoStep ? "On" : "Off" },
  { href: "/account/legal", label: "Privacy and legal", note: "Privacy, cookies, terms", icon: "legal", tint: "#5b6068" },
];
