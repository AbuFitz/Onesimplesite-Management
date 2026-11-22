import { LegalLinks } from "@/components/legal-links";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { can, ROLE_INFO } from "@/modules/identity/permissions";
import { Rail, type NavGroup } from "@/components/nav";
import { TeamDock } from "@/components/mobile-dock";
import { cookies } from "next/headers";
import { SmartBubble } from "@/components/smart-bubble";
import { CommandPalette } from "@/components/command-palette";
import { NewMenu, UserMenu } from "@/components/menus";
import { after } from "next/server";
import { maybeRunReminders } from "@/modules/support/reminders";
import { supportCounts } from "@/modules/support/service";
import { signOutStaff } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children, modal }: { children: React.ReactNode; modal: React.ReactNode }) {
  const ctx = await requireStaff();
  after(() => maybeRunReminders().catch(() => {}));
  const seeCustomers = can(ctx.role, "customer.read");
  const supportOpen = seeCustomers ? (await supportCounts(ctx.workspaceId)).open : 0;
  // Only built modules appear. Unfinished modules are hidden, not faked.
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Today", icon: "today" }] },
    ...(seeCustomers ? [{ label: "Sales", items: [{ href: "/customers", label: "Companies", icon: "customers" }, { href: "/agreements", label: "Agreements", icon: "contracts" }, { href: "/payments", label: "Payments", icon: "payments" }, { href: "/referrals", label: "Referrals", icon: "referrals" }] }] : []),
    { label: "Work", items: [...(seeCustomers ? [{ href: "/tickets", label: "Tickets", icon: "pipeline", badge: supportOpen }] : []), { href: "/projects", label: "Projects", icon: "projects" }, { href: "/calendar", label: "Calendar", icon: "calendar" }, { href: "/board", label: "Board", icon: "notes" }, ...(can(ctx.role, "vault.use") ? [{ href: "/vault", label: "Passwords", icon: "vault" }] : [])] },
    { label: "Company", items: [
      ...(can(ctx.role, "settings.write") ? [{ href: "/settings", label: "Settings", icon: "settings" }] : []),
    ] },
    ...(can(ctx.role, "settings.write") ? [{ label: "Testing", items: [{ href: "/testing", label: "Testing", icon: "testing" }] }] : []),
  ].filter((g) => g.items.length) as NavGroup[];
  const profileTodo = profileMissing(await getMyProfile(ctx));
  const create = [
    ...(can(ctx.role, "proposal.write") ? [{ href: "/tickets/new", label: "New ticket" }, { href: "/customers/new", label: "Add a company" }] : []),
    ...(can(ctx.role, "calendar.write") ? [{ href: "/calendar/new", label: "New event" }] : []),
    ...(can(ctx.role, "notes.write") ? [{ href: "/board", label: "Post to the board" }] : []),
  ];
  const railOpen = (await cookies()).get("oss_rail")?.value !== "closed";
  return (
    <div className="oss-shell" data-rail={railOpen ? "open" : "closed"}>
      <LiveRefresh />
      <div className="oss-frame">
        <Rail groups={groups} open={railOpen} />
        <div className="oss-stage">
          {/* Phones: this bar is part of the page and scrolls away (nothing sticky), so content gets the whole screen. */}
          <div className="oss-bar">
            <Link href="/" aria-label="OneSimpleSite Manage, home" className="logo lg:hidden"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={132} height={27} priority /></Link>
            <CommandPalette actions={create} />
            <div className="ml-auto flex items-center gap-2">
              <div className="hidden lg:block"><NewMenu links={create} /></div>
              <UserMenu staffId={ctx.staffId} name={ctx.name} role={ROLE_INFO[ctx.role].label.replace(" (recommended)", "")}>
                <form action={signOutStaff}><button role="menuitem" className="pop-item w-full text-left">Sign out</button></form>
              </UserMenu>
            </div>
          </div>
          {profileTodo.length > 0 && (
            <Link href="/account" className="mx-4 mb-2 flex items-center justify-center gap-2 rounded-2xl bg-lime px-4 py-2.5 text-center text-sm text-olive-950 lg:mx-6">
              <span>Finish setting up your profile: add your {profileTodo.join(" and ")}.</span><ArrowRight size={15} aria-hidden />
            </Link>
          )}
          <main id="main" className="page min-w-0">{children}<LegalLinks className="mt-12 justify-start" /></main>
        </div>
      </div>
      {modal}
      <SmartBubble />
      <TeamDock groups={groups} actions={create} />
    </div>
  );
}
