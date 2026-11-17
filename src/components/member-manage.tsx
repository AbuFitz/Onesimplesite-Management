"use client";
import { useState } from "react";
import { Settings2 } from "lucide-react";
import { Sheet } from "./sheet";
import { ConfirmForm } from "./confirm";

type Act = (fd: FormData) => void | Promise<void>;
type Role = { value: string; label: string; summary: string };

/**
 * Everything you can do to one team member, behind one "Manage" button: their level (as clear choices, with what each allows),
 * the address customers see emails from, and the two risky actions (deactivate, reset two-step) which always ask first.
 */
export function MemberManage({ m, roles, self, owner, actions }: {
  m: { id: string; name: string; role: string; status: string; alias: string; hasUser: boolean };
  roles: Role[]; self: boolean; owner: boolean;
  actions: { changeRole: Act; setActive: Act; setAlias: Act; resetTwoStep: Act };
}) {
  const [open, setOpen] = useState(false);
  const first = m.name.split(" ")[0];
  return (
    <>
      <button type="button" className="mm-btn" onClick={() => setOpen(true)} aria-haspopup="dialog"><Settings2 size={16} aria-hidden /> Manage<span className="sr-only"> {m.name}</span></button>
      <Sheet open={open} onClose={() => setOpen(false)} title={self ? "Your settings" : `Manage ${first}`}>
        <div className="mm">
          {!self && (
            <form action={actions.changeRole} className="mm-sec">
              <input type="hidden" name="id" value={m.id} />
              <h3>Access level</h3>
              <div className="opts">
                {roles.map((r) => (
                  <label key={r.value} className="opt"><input type="radio" name="role" value={r.value} defaultChecked={r.value === m.role} /><span><b>{r.label.replace(" (recommended)", "")}</b><small>{r.summary}</small></span></label>
                ))}
              </div>
              <button className="mm-save">Save level</button>
            </form>
          )}
          <form action={actions.setAlias} className="mm-sec">
            <input type="hidden" name="id" value={m.id} />
            <h3>Customers see emails from</h3>
            <div className="grp"><label className="grp-row" htmlFor={`a-${m.id}`}><span>Email</span><input id={`a-${m.id}`} name="alias" defaultValue={m.alias} placeholder="name@onesimplesite.co.uk" autoCapitalize="none" inputMode="email" /></label></div>
            <button className="mm-save">Save address</button>
          </form>
          {!self && (
            <div className="mm-sec mm-danger">
              <h3>Access</h3>
              <ConfirmForm action={actions.setActive} confirmLabel={m.status === "deactivated" ? "Reactivate" : "Deactivate"} message={m.status === "deactivated" ? `Let ${first} sign in again?` : `${first} is signed out everywhere straight away. Their past activity stays on record.`}>
                <input type="hidden" name="id" value={m.id} /><input type="hidden" name="active" value={m.status === "deactivated" ? "1" : "0"} />
                <button className="mm-quiet">{m.status === "deactivated" ? `Reactivate ${first}` : `Deactivate ${first}`}</button>
              </ConfirmForm>
              {owner && m.hasUser && (
                <ConfirmForm action={actions.resetTwoStep} confirmLabel="Reset two-step" message={`Removes ${first}'s authenticator app, passkeys and trusted devices and signs them out. They set it up again at next sign-in.`}>
                  <input type="hidden" name="id" value={m.id} />
                  <button className="mm-quiet">Reset two-step for {first}</button>
                </ConfirmForm>
              )}
            </div>
          )}
        </div>
      </Sheet>
    </>
  );
}
