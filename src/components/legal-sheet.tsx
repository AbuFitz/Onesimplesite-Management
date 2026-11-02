import type { ReactNode } from "react";
import { DocSheet } from "./doc";

export type SheetMeta = { title: string; ref: string; version: string; status: string; date: string; audience: string };

/** A legal document as issued: the same sheet as every other OneSimpleSite document. */
export function LegalSheet({ meta, intro, children }: { meta: SheetMeta; intro?: string; children: ReactNode }) {
  return (
    <DocSheet meta={{ title: meta.title, ref: meta.ref, date: meta.date, version: meta.version, status: meta.status, mark: meta.audience, footMark: meta.audience === "Private & confidential" ? "Private & confidential" : "Customer-facing" }}>
      {intro && <p className="d-lead">{intro}</p>}
      {children}
    </DocSheet>
  );
}
