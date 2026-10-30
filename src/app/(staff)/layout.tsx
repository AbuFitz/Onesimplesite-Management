import Image from "next/image";
import Link from "next/link";
import { requireStaff } from "@/modules/identity/session";
import { can } from "@/modules/identity/permissions";
import { SideNav, BottomNav, type NavItem } from "@/components/nav";
import { signOutStaff } from "@/app/actions/auth";

export const dynamic = "force-dynamic";

export default async function StaffLayout({ children }: { children: React.ReactNode }) {
  const ctx = await requireStaff();
  // Only built modules appear. Unfinished modules are hidden, not faked.
  const items: NavItem[] = [
    { href: "/", label: "Today", icon: "today" },
    ...(can(ctx.role, "customer.read") ? [{ href: "/customers", label: "Customers", icon: "customers" }, { href: "/pipeline", label: "Pipeline", icon: "pipeline" }, { href: "/proposals", label: "Proposals", icon: "proposals" }, { href: "/contracts", label: "Contracts", icon: "contracts" }] : []),
    { href: "/projects", label: "Projects", icon: "projects" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/notes", label: "Notes", icon: "notes" },
    ...(can(ctx.role, "settings.write") ? [{ href: "/settings", label: "Settings", icon: "settings" }] : []),
    ...(can(ctx.role, "data.export") ? [{ href: "/backup", label: "Backup", icon: "backup" }] : []),
    ...(can(ctx.role, "staff.manage") ? [{ href: "/team", label: "Team", icon: "team" }] : []),
  ];
  return (
    <div className="lg:grid lg:grid-cols-[15rem_1fr] min-h-dvh">
      <aside className="hidden lg:flex flex-col gap-6 border-r border-line p-4 sticky top-0 h-dvh">
        <Link href="/" aria-label="OneSimpleSite Manage home" className="px-2 pt-2">
          <Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={160} height={32} priority />
          <span className="block text-xs text-muted mt-1">Manage</span>
        </Link>
        <SideNav items={items} />
        <div className="mt-auto text-sm">
          <p className="font-semibold truncate">{ctx.name}</p>
          <p className="text-muted text-xs mb-2">{ctx.role.replace("_", " ")}</p>
          <a className="btn btn-quiet w-full mb-2" href="/account">My account</a>
          <form action={signOutStaff}><button className="btn btn-quiet w-full">Sign out</button></form>
        </div>
      </aside>
      <div className="min-w-0">
        <div className="lg:hidden flex items-center justify-between px-4 h-14 border-b border-line" style={{ paddingTop: "env(safe-area-inset-top)" }}>
          <Link href="/" aria-label="Home"><Image src="/brand/wordmark-colour.svg" alt="OneSimpleSite" width={120} height={24} /></Link>
          <Link href="/customers/new" className="btn" aria-label="New enquiry">+ New</Link>
        </div>
        <main id="main" className="page">{children}</main>
      </div>
      <BottomNav />
    </div>
  );
}
