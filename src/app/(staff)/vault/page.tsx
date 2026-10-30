import { requireStaff } from "@/modules/identity/session";
import { listVault } from "@/modules/vault/service";
import { RecordHeader, Empty } from "@/components/ui";
import { VaultForm, VaultItem } from "@/components/vault-ui";

export const metadata = { title: "Passwords" };

export default async function Vault({ searchParams }: { searchParams: Promise<{ q?: string; type?: string }> }) {
  const ctx = await requireStaff("vault.use");
  const { q = "", type = "" } = await searchParams;
  const all = await listVault(ctx);
  const needle = q.trim().toLowerCase();
  const rows = all.filter((r) => (!type || r.category === type) && (!needle || [r.title, r.username, r.url, r.notes].some((v) => v?.toLowerCase().includes(needle))));
  const types = [...new Set(all.map((r) => r.category))].sort();
  return (
    <>
      <RecordHeader title="Passwords" meta={`Shared team logins · ${all.length} saved`} />
      <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
        <section>
          <form className="mb-4 flex flex-wrap gap-2" role="search">
            <label htmlFor="vq" className="sr-only">Search passwords</label>
            <input id="vq" name="q" defaultValue={q} className="field min-w-0 flex-1" placeholder="Search by name, username or website" />
            {types.length > 1 && (
              <select name="type" defaultValue={type} className="field w-auto" aria-label="Filter by type">
                <option value="">All types</option>{types.map((t) => <option key={t} value={t}>{t[0].toUpperCase() + t.slice(1)}</option>)}
              </select>
            )}
            <button className="btn btn-quiet">Search</button>
          </form>
          {rows.length === 0 ? (
            <Empty title={all.length ? "Nothing matches" : "No logins saved yet"}>{all.length ? "Try a different word." : "Add the first one using the form."}</Empty>
          ) : (
            <ul>{rows.map((r) => <VaultItem key={r.id} row={{ ...r, updatedAt: r.updatedAt.toISOString() }} />)}</ul>
          )}
        </section>
        <aside className="lg:sticky lg:top-20 lg:self-start">
          <h2 className="mb-3">Add a login</h2>
          <VaultForm />
          <p className="hint mt-4">Everyone on the team can see these. Passwords are encrypted in the database, and every time one is shown or changed it is recorded with the person's name. They are not included in the backup file.</p>
        </aside>
      </div>
    </>
  );
}
