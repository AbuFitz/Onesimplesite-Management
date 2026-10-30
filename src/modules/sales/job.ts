import { CATEGORIES, REACH, WORK_TYPES, EXTRAS, SIZES, DOMAINS, CONTENT, TIMING, PAYMENT_PLANS, PRIORITIES, SOURCES } from "./job-options";

const titleCase = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);
const pick = <T extends string>(v: FormDataEntryValue | null, allowed: readonly T[]): T | undefined => allowed.find((a) => a === v);

/** Turns the popup's plain answers into the lead note and the draft quote the rest of the app already understands. */
export function composeJob(fd: FormData) {
  const get = (k: string) => String(fd.get(k) ?? "").trim();
  const work = WORK_TYPES.find((w) => w.id === fd.get("work")) ?? WORK_TYPES[0];
  const category = pick(fd.get("category"), CATEGORIES);
  const reach = pick(fd.get("reach"), REACH);
  const town = get("town");
  const extras = fd.getAll("extras").map(String).filter((x): x is (typeof EXTRAS)[number] => (EXTRAS as readonly string[]).includes(x));
  const size = pick(fd.get("size"), SIZES), domain = pick(fd.get("domain"), DOMAINS), content = pick(fd.get("content"), CONTENT), timing = pick(fd.get("timing"), TIMING);
  const plan = PAYMENT_PLANS.find((p) => p.id === fd.get("plan"));
  const notes = get("notes");
  const description = get("description");
  const priority = PRIORITIES.find((p) => p.id === fd.get("priority"))?.id ?? "normal";
  const source = pick(fd.get("source"), SOURCES);
  const due = /^\d{4}-\d{2}-\d{2}$/.test(get("dueDate")) ? new Date(`${get("dueDate")}T12:00:00Z`) : null;

  const about = [category && `Type of business: ${category}`, town && `Based in: ${town}`, reach && `Customers: ${reach.toLowerCase()}`].filter(Boolean) as string[];
  const lines = [] as { description: string; quantity: number; unitMinor: number; recurring: boolean }[];
  for (let i = 0; i < 6; i++) {
    const d = get(`l${i}d`); if (!d) continue;
    lines.push({ description: d, quantity: 1, unitMinor: Math.round(Number(get(`l${i}p`) || 0) * 100), recurring: fd.get(`l${i}r`) === "on" });
  }
  const requirements: Record<string, string> = {};
  if (size) requirements.pages = size;
  if (extras.length) requirements.features = extras.join("\n");
  if (domain) requirements.domainHosting = domain;
  if (content) requirements.contentBy = content;
  if (timing) requirements.timeline = timing;
  if (plan?.text) requirements.payment = plan.text;
  const noteLines = [...about, notes].filter(Boolean).join("\n");
  if (noteLines) requirements.notes = noteLines;

  return {
    category, town, work, priority, source, due, assigneeId: get("assigneeId") || null,
    leadNote: [...about, `Wants: ${work.label}`, description, extras.length ? `Extras: ${extras.join(", ")}` : "", notes].filter(Boolean).join("\n"),
    proposal: {
      title: get("title") || titleCase(`${work.label} for ${get("displayName") || "customer"}`.replace(/^(A|An) /, "")),
      scope: description || `${work.label}${town ? ` in ${town}` : ""}. ${work.hint}`,
      terms: "",
      recurringPeriod: (fd.get("recurringPeriod") || undefined) as "month" | "year" | undefined,
      requirements, lines,
    },
  };
}
