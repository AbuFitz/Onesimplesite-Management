import { describe, it, expect } from "vitest";
import { databaseMixUp, LIVE_DB_REF, DEV_DB_REF } from "@/lib/db-guard";

describe("live and dev databases are never mixed up", () => {
  it("stops a dev or test site using the live database, and the live site using the dev one", () => {
    expect(databaseMixUp("staging", `postgresql://oss_app.${LIVE_DB_REF}:x@h/postgres`)).toMatch(/LIVE database/);
    expect(databaseMixUp("development", `postgresql://u:x@db.${LIVE_DB_REF}.supabase.co/postgres`)).toMatch(/LIVE database/);
    expect(databaseMixUp(undefined, `postgresql://u:x@db.${LIVE_DB_REF}.supabase.co/postgres`)).toMatch(/LIVE database/);
    expect(databaseMixUp("production", `postgresql://oss_app.${DEV_DB_REF}:x@h/postgres`)).toMatch(/DEV database/);
  });
  it("lets each use its own, and local databases", () => {
    expect(databaseMixUp("production", `postgresql://oss_app.${LIVE_DB_REF}:x@h/postgres`)).toBeNull();
    expect(databaseMixUp("staging", `postgresql://oss_app.${DEV_DB_REF}:x@h/postgres`)).toBeNull();
    expect(databaseMixUp("development", "postgresql://oss_migrate:x@localhost:5432/oss_manage")).toBeNull();
    expect(databaseMixUp("development", undefined)).toBeNull();
  });
});
