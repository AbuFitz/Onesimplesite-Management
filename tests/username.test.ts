import { describe, it, expect } from "vitest";
import { baseUsername } from "@/modules/identity/username";

describe("staff username", () => {
  it("is first.surname, lowercase, ascii", () => {
    expect(baseUsername("Jane Smith")).toBe("jane.smith");
    expect(baseUsername("Jane Mary O'Brien-Smith")).toBe("jane.obriensmith");
    expect(baseUsername("  Zoë  Müller ")).toBe("zoe.muller");
  });
  it("needs a first name and a surname", () => {
    expect(baseUsername("Madonna")).toBeNull();
    expect(baseUsername("")).toBeNull();
  });
});
