import type { AccountItem } from "@/components/account-nav";
export const accountItems = (s: { profileNote?: string; twoStep: boolean }): AccountItem[] => [
  { href: "/account/profile", label: "Profile and signature", note: "Name, job title, phone, email signature", icon: "profile", tint: "#4a6024", status: s.profileNote },
  { href: "/account/email", label: "Sign-in email", note: "The address you sign in with", icon: "email", tint: "#2b8aa0" },
  { href: "/account/password", label: "Password", note: "Change it any time", icon: "password", tint: "#b7791f" },
  { href: "/referrals/mine", label: "My referral link", note: "Send work our way and be credited", icon: "referrals", tint: "#2f7a4e" },
  { href: "/account/security", label: "Two-step sign-in", note: "Authenticator app, passkeys, devices", icon: "security", tint: "#161d0b", status: s.twoStep ? "On" : "Off" },
];
