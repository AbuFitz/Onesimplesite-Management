"use client";
import { useId } from "react";
import { normalisePostcode } from "@/lib/address";

/** Address as separate boxes. The postcode is tidied as you leave it ("sw1a1aa" becomes "SW1A 1AA"). */
export function AddressFields({ defaults, required = false, legend = "Address" }: { defaults?: { addressLine1?: string | null; addressLine2?: string | null; town?: string | null; postcode?: string | null }; required?: boolean; legend?: string }) {
  const id = useId();
  return (
    <fieldset className="sm:col-span-2">
      <legend className="label mb-2">{legend} {!required && <span className="font-normal text-muted">(needed before an agreement is sent, can be added later)</span>}</legend>
      <div className="grid gap-3 sm:grid-cols-6">
        <div className="sm:col-span-6"><label className="label" htmlFor={`${id}1`}>Address line 1</label><input id={`${id}1`} name="addressLine1" className="field" autoComplete="address-line1" maxLength={120} placeholder="House number and street" defaultValue={defaults?.addressLine1 ?? ""} required={required} /></div>
        <div className="sm:col-span-6"><label className="label" htmlFor={`${id}2`}>Address line 2 <span className="font-normal text-muted">(optional)</span></label><input id={`${id}2`} name="addressLine2" className="field" autoComplete="address-line2" maxLength={120} placeholder="Unit, building or area" defaultValue={defaults?.addressLine2 ?? ""} /></div>
        <div className="sm:col-span-4"><label className="label" htmlFor={`${id}3`}>Town or city</label><input id={`${id}3`} name="town" className="field" autoComplete="address-level2" maxLength={80} defaultValue={defaults?.town ?? ""} required={required} /></div>
        <div className="sm:col-span-2"><label className="label" htmlFor={`${id}4`}>Postcode</label><input id={`${id}4`} name="postcode" className="field uppercase" autoComplete="postal-code" maxLength={10} placeholder="BS1 4DJ" defaultValue={defaults?.postcode ?? ""} required={required} onBlur={(e) => { e.currentTarget.value = normalisePostcode(e.currentTarget.value); }} /></div>
      </div>
    </fieldset>
  );
}
