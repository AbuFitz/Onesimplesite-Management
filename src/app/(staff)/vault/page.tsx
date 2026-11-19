import { Search } from "lucide-react";
import { requireStaff } from "@/modules/identity/session";
import { listVault } from "@/modules/vault/service";
import { Empty } from "@/components/ui";
import { AutoGetForm } from "@/components/auto-form";
import { QuickChips } from "@/components/filter-bar";
import { AddLogin, VaultItem } from "@/components/vault-ui";

export const metadata = { title: "Passwords" };

export default async function Vault({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const ctx = await requireStaff("vault.use");
  const { q = "", type = "" } = await searchParams;
  const all = await listVault(ctx);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => (!type || r.category === type) && (!needle || [r.title, r.username, r.url, r.notes].some((v) => v?.toLowerCase().includes(needle))));
  const types = [...new Set(all.map((r) => r.category))].sort();
  const href = (t: string) => { const p = new URLSearchParams(); if (t) p.set("type", t); if (q) p.set("q", q); const s = p.toString(); return `/vault${s ? `?${s}` : ""}`; };
  return (
    <>
      <h1 className="sr-only">Passwords</h1>
      <div className="lt">
        <AutoGetForm className="lt-form">
          <div className="lt-row">
            <label className="lt-search"><span className="sr-only">Search passwords</span><Search size={17} aria-hidden /><input id="vq" name="q" type="search" defaultValue={q} placeholder="Search logins" autoComplete="off" /></label>
            {type && <input type="hidden" name="type" value={type} />}
            <AddLogin />
          </div>
        </AutoGetForm>
        {types.length > 1 && <QuickChips label="Type" items={[{ label: "All", count: all.length, href: href(""), on: !type }, ...types.map((t) => ({ label: t[0].toUpperCase() + t.slice(1), count: all.filter((r) => r.category === t).length, href: href(t), on: type === t }))]} />}
        <p className="lt-count">{rows.length} {rows.length === 1 ? "login" : "logins"}</p>
      </div>
      {rows.length === 0 ? (
        <Empty title={all.length ? "Nothing matches" : "No logins yet"}>{all.length ? "Try a different word." : "Use Add a login."}</Empty>
      ) : (
        <ul className="divide-y divide-line rounded-2xl border border-line bg-white px-4">{rows.map((r) => <VaultItem key={r.id} row={{ ...r, updatedAt: r.updatedAt.toISOString() }} />)}</ul>
      )}
    </>
  );
}
