import { describe, it, expect } from "vitest";
import { londonToUtc } from "@/lib/london";

describe("London wall-clock to UTC", () => {
  it("is the same in winter (GMT)", () => expect(londonToUtc("2026-12-01", "09:30").toISOString()).toBe("2026-12-01T09:30:00.000Z"));
  it("is an hour earlier in summer (BST)", () => expect(londonToUtc("2026-07-01", "09:30").toISOString()).toBe("2026-07-01T08:30:00.000Z"));
  it("handles midnight", () => expect(londonToUtc("2026-07-01", "00:15").toISOString()).toBe("2026-06-30T23:15:00.000Z"));
});
