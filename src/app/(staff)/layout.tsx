import { LegalLinks } from "@/components/legal-links";
import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can, ROLE_INFO } from "@/modules/identity/permissions";
import { SideNav, BottomNav, type NavGroup } from "@/components/nav";
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
    ...(seeCustomers ? [{ label: "Sales", items: [{ href: "/customers", label: "Businesses", icon: "customers" }, { href: "/tickets", label: "Tickets", icon: "pipeline", badge: supportOpen }] }] : []),
    { label: "Work", items: [{ href: "/projects", label: "Projects", icon: "projects" }, { href: "/calendar", label: "Calendar", icon: "calendar" }, { href: "/board", label: "Board", icon: "notes" }, ...(can(ctx.role, "vault.use") ? [{ href: "/vault", label: "Passwords", icon: "vault" }] : [])] },
    { label: "Business", items: [
      ...(can(ctx.role, "settings.write") ? [{ href: "/settings", label: "Business settings", icon: "settings" }] : []),
      ...(can(ctx.role, "data.export") ? [{ href: "/backup", label: "Backup", icon: "backup" }] : []),
      ...(can(ctx.role, "staff.manage") ? [{ href: "/team", label: "Team", icon: "team" }] : []),
    ] },
    ...(can(ctx.role, "settings.write") ? [{ label: "Testing", items: [{ href: "/testing", label: "Testing", icon: "testing" }] }] : []),
  ].filter((g) => g.items.length) as NavGroup[];
  const profileTodo = profileMissing(await getMyProfile(ctx));
  const create = [
    ...(can(ctx.role, "proposal.write") ? [{ href: "/tickets/new", label: "New ticket" }, { href: "/customers/new", label: "Add a business" }] : []),
    ...(can(ctx.role, "calendar.write") ? [{ href: "/calendar/new", label: "New event" }] : []),
    ...(can(ctx.role, "notes.write") ? [{ href: "/board", label: "Post to the board" }] : []),
  ];
  return (
    <div className="staff-theme min-h-dvh bg-white lg:bg-app">
      <LiveRefresh />
      {profileTodo.length > 0 && (
        <Link href="/account" className="flex items-center justify-center gap-2 bg-[#eef7f2] px-4 py-2 text-center text-sm text-moss hover:bg-[#e3f2ea]">
          <span>Finish setting up your profile: add your {profileTodo.join(" and ")}.</span><ArrowRight size={15} aria-hidden />
        </Link>
      )}
      <header className="sticky top-0 z-30 border-b border-line bg-white" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Link href="/" aria-label="OneSimpleSite Manage, home" className="flex items-center gap-2.5 lg:w-[11rem]">
            <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={126} height={26} priority />
          </Link>
          <CommandPalette actions={create} />
          <div className="ml-auto flex items-center gap-2">
            <span className="sm:hidden"><Link href="/search" aria-label="Search" className="btn btn-quiet !min-h-10 !px-3"><Search size={17} aria-hidden /></Link></span>
            <NewMenu links={create} />
            <UserMenu staffId={ctx.staffId} name={ctx.name} role={ROLE_INFO[ctx.role].label.replace(" (recommended)", "")}>
              <form action={signOutStaff}><button role="menuitem" className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-soft">Sign out</button></form>
            </UserMenu>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[14.5rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-line bg-white p-3 pt-4 lg:block"><SideNav groups={groups} /></aside>
        <main id="main" className="page panel min-w-0">{children}<LegalLinks className="mt-12 justify-start" /></main>
      </div>
      {modal}
      <SmartBubble />
      <BottomNav />
    </div>
  );
}
