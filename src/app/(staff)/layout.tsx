import { getMyProfile, profileMissing } from "@/modules/identity/profile";
import { ArrowRight } from "lucide-react";
import { db } from "@/lib/db";
import { NewJob } from "@/components/new-job";
import { LiveRefresh } from "@/components/live-refresh";
import Image from "next/image";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { can, ROLE_INFO } from "@/modules/identity/permissions";
import { SideNav, BottomNav, type NavGroup } from "@/components/nav";
import { NewMenu, UserMenu } from "@/components/menus";
import { signOutStaff } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  const seeCustomers = can(ctx.role, "customer.read");
  // Only built modules appear. Unfinished modules are hidden, not faked.
  const groups: NavGroup[] = [
    { items: [{ href: "/", label: "Today", icon: "today" }] },
    ...(seeCustomers ? [{ label: "Sales", items: [{ href: "/customers", label: "Customers", icon: "customers" }, { href: "/pipeline", label: "Tickets", icon: "pipeline" }, { href: "/proposals", label: "Quotes", icon: "proposals" }, { href: "/contracts", label: "Agreements", icon: "contracts" }] }] : []),
    { label: "Work", items: [{ href: "/projects", label: "Projects", icon: "projects" }, { href: "/calendar", label: "Calendar", icon: "calendar" }, { href: "/notes", label: "Notes", icon: "notes" }, ...(can(ctx.role, "vault.use") ? [{ href: "/vault", label: "Passwords", icon: "vault" }] : [])] },
    { label: "Business", items: [
      ...(can(ctx.role, "settings.write") ? [{ href: "/settings", label: "Business settings", icon: "settings" }] : []),
      ...(can(ctx.role, "data.export") ? [{ href: "/backup", label: "Backup", icon: "backup" }] : []),
      ...(can(ctx.role, "staff.manage") ? [{ href: "/team", label: "Team", icon: "team" }] : []),
    ] },
  ].filter((g) => g.items.length) as NavGroup[];
  const jobCustomers = can(ctx.role, "proposal.write")
    ? (await db.customer.findMany({ where: { workspaceId: ctx.workspaceId }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true }, take: 300 })).map((c) => ({ id: c.id, name: c.displayName }))
    : [];
  const jobTeam = can(ctx.role, "proposal.write")
    ? (await db.staffMembership.findMany({ where: { workspaceId: ctx.workspaceId, status: "active", id: { not: ctx.staffId } }, orderBy: { displayName: "asc" }, select: { id: true, displayName: true } })).map((m) => ({ id: m.id, name: m.displayName }))
    : [];
  const profileTodo = profileMissing(await getMyProfile(ctx));
  const create = [
    ...(can(ctx.role, "proposal.write") ? [{ href: "?new=ticket", label: "New ticket" }] : []),
    ...(can(ctx.role, "calendar.write") ? [{ href: "/calendar/new", label: "New event" }] : []),
    ...(can(ctx.role, "notes.write") ? [{ href: "/notes", label: "New note" }] : []),
  ];
  return (
    <div className="min-h-dvh bg-white lg:bg-app">
      <LiveRefresh />
      {profileTodo.length > 0 && (
        <Link href="/account" className="flex items-center justify-center gap-2 bg-[#eef7f2] px-4 py-2 text-center text-sm text-moss hover:bg-[#e3f2ea]">
          <span>Finish setting up your profile: add your {profileTodo.join(" and ")}.</span><ArrowRight size={15} aria-hidden />
        </Link>
      )}
      {can(ctx.role, "proposal.write") && <NewJob customers={jobCustomers} team={jobTeam} />}
      <header className="sticky top-0 z-30 border-b border-line bg-white shadow-[0_1px_0_rgba(14,19,17,.03)]" style={{ paddingTop: "env(safe-area-inset-top)" }}>
        <div className="flex h-14 items-center gap-3 px-4 lg:px-6">
          <Link href="/" aria-label="OneSimpleSite Manage, home" className="flex items-center gap-2.5 lg:w-[11rem]">
            <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={126} height={26} priority />
          </Link>
          <form action="/search" role="search" className="relative mx-auto hidden max-w-lg flex-1 sm:block">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <label htmlFor="gs" className="sr-only">Search</label>
            <input id="gs" name="q" type="search" placeholder="Search customers, agreements, projects" className="field !min-h-9 !rounded-full !bg-soft !border-transparent !pl-9 !text-sm hover:!border-line focus:!bg-white" />
          </form>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/search" aria-label="Search" className="btn btn-quiet !min-h-10 !px-3 sm:hidden"><Search size={17} aria-hidden /></Link>
            <NewMenu links={create} />
            <UserMenu name={ctx.name} role={ROLE_INFO[ctx.role].label.replace(" (recommended)", "")}>
              <form action={signOutStaff}><button role="menuitem" className="flex min-h-10 w-full items-center rounded-lg px-3 text-left text-sm text-ink hover:bg-soft">Sign out</button></form>
            </UserMenu>
          </div>
        </div>
      </header>
      <div className="lg:grid lg:grid-cols-[14.5rem_1fr]">
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto p-3 lg:block"><SideNav groups={groups} /></aside>
        <main id="main" className="page panel min-w-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
