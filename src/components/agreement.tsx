import { DocBody } from "./doc";

/** Renders agreement text in the OneSimpleSite document design. Kept as the single entry point for every screen that shows agreement text. */
export function AgreementText({ text, hideSign }: { text: string; hideSign?: (label: string) => boolean }) {
  return <DocBody text={text} hideSign={hideSign} />;
}
