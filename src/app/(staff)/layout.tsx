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
    ...(seeCustomers ? [{ label: "Sales", items: [{ href: "/customers", label: "Customers", icon: "customers" }, { href: "/pipeline", label: "Pipeline", icon: "pipeline" }, { href: "/proposals", label: "Proposals", icon: "proposals" }, { href: "/contracts", label: "Agreements", icon: "contracts" }] }] : []),
    { label: "Work", items: [{ href: "/projects", label: "Projects", icon: "projects" }, { href: "/calendar", label: "Calendar", icon: "calendar" }, { href: "/notes", label: "Notes", icon: "notes" }] },
    { label: "Admin", items: [
      ...(can(ctx.role, "settings.write") ? [{ href: "/settings", label: "Settings", icon: "settings" }] : []),
      ...(can(ctx.role, "data.export") ? [{ href: "/backup", label: "Backup", icon: "backup" }] : []),
      ...(can(ctx.role, "staff.manage") ? [{ href: "/team", label: "Team", icon: "team" }] : []),
    ] },
  ].filter((g) => g.items.length) as NavGroup[];
  const create = [
    ...(can(ctx.role, "customer.write") ? [{ href: "/customers/new", label: "New enquiry" }] : []),
    ...(can(ctx.role, "calendar.write") ? [{ href: "/calendar/new", label: "New event" }] : []),
    ...(can(ctx.role, "notes.write") ? [{ href: "/notes", label: "New note" }] : []),
  ];
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-30 border-b border-line bg-white/95 backdrop-blur" style={{ paddingTop: "env(safe-area-inset-top)" }}>
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
        <aside className="sticky top-14 hidden h-[calc(100dvh-3.5rem)] overflow-y-auto border-r border-line p-3 lg:block"><SideNav groups={groups} /></aside>
        <main id="main" className="page min-w-0">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
