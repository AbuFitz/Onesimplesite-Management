/** Minimal Stripe REST client (no SDK). Keys live in the environment only. */
const BASE = "https://api.stripe.com/v1";

export const stripeReady = () => !!process.env.STRIPE_SECRET_KEY;

/** Stripe wants nested form fields: a[b][0]=c. */
export function formEncode(obj: Record<string, unknown>, prefix = "", out: string[] = []): string {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (Array.isArray(v)) v.forEach((x, i) => (typeof x === "object" ? formEncode(x as Record<string, unknown>, `${key}[${i}]`, out) : out.push(`${encodeURIComponent(`${key}[${i}]`)}=${encodeURIComponent(String(x))}`)));
    else if (typeof v === "object") formEncode(v as Record<string, unknown>, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join("&");
}

export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, unknown>, o: { method?: "GET" | "POST"; idempotencyKey?: string } = {}): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error("Stripe is not set up.");
  const method = o.method ?? (params ? "POST" : "GET");
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, ...(method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(o.idempotencyKey ? { "Idempotency-Key": o.idempotencyKey } : {}) },
    body: method === "POST" ? formEncode(params ?? {}) : undefined,
    cache: "no-store",
  });
  const json = (await res.json().catch(() => ({}))) as T & { error?: { message?: string } };
  if (!res.ok) throw new Error(json.error?.message ?? `Stripe error ${res.status}`);
  return json;
}
