const TZ = "Europe/London";
/** "Good morning" / "Good afternoon" / "Good evening" by the clock in the UK, so it is right wherever the server runs. */
export function greeting(now = new Date()): string {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hourCycle: "h23", timeZone: TZ }).format(now));
  return h >= 5 && h < 12 ? "Good morning" : h >= 12 && h < 18 ? "Good afternoon" : h >= 18 && h < 23 ? "Good evening" : "Hello";
}
export const todayLabel = (now = new Date()) => new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(now);
