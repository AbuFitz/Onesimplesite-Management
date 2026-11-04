import { describe, it, expect } from "vitest";
import { safeNext } from "@/lib/next-path";

describe("returning to the page someone asked for", () => {
  it("accepts pages on this site and refuses anything else", () => {
    expect(safeNext("/help")).toBe("/help"); expect(safeNext("/help/abc?x=1")).toBe("/help/abc?x=1"); expect(safeNext("/projects/1#files")).toBe("/projects/1#files");
    for (const bad of ["https://evil.example/help", "//evil.example", "/\\evil.example", "help", "", null, undefined, "/login", "/login?next=/x", "/api/auth/x", "/setup-security", "/a\nb", "/" + "x".repeat(600)]) expect(safeNext(bad), String(bad)).toBeNull();
  });
});
