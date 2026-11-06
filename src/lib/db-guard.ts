/**
 * Two databases exist: the live one and the dev one. A site may only ever use its own, so a mix-up stops the app with a clear message
 * instead of quietly touching real customers (or filling live with test data). The ids are the Supabase project ids.
 */
export const LIVE_DB_REF = "mxjgysmphfsofqiucxxz", DEV_DB_REF = "ejssfyuvhsgvpqzctowa";

export function databaseMixUp(appEnv: string | undefined, databaseUrl: string | undefined): string | null {
  const url = databaseUrl ?? "", env = appEnv ?? "development";
  if (env !== "production" && url.includes(LIVE_DB_REF)) return "This is not the live site, but it is pointed at the LIVE database. Refusing to start.";
  if (env === "production" && url.includes(DEV_DB_REF)) return "This is the live site, but it is pointed at the DEV database. Refusing to start.";
  return null;
}
