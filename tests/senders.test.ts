import { describe, it, expect } from "vitest";
import { personFrom, suggestAlias, isOurAddress, fmtFrom, SENDERS } from "@/lib/sender-identities";

describe("sender identities", () => {
  it("people write as 'First at OneSimpleSite' from their own alias, never their sign-in address", () => {
    expect(personFrom("Abukar Sharif", "abukar@onesimplesite.co.uk")).toBe("Abukar at OneSimpleSite <abukar@onesimplesite.co.uk>");
    expect(personFrom("Abukar Sharif", null)).toBe(fmtFrom("general"));
  });
  it("suggests a first-name alias and only accepts addresses on our own domain", () => {
    expect(suggestAlias("Zoë Müller")).toBe("zoe@onesimplesite.co.uk");
    expect(isOurAddress("matthew@onesimplesite.co.uk")).toBe(true);
    expect(isOurAddress("matthew@gmail.com")).toBe(false);
    expect(isOurAddress("x@onesimplesite.co.uk.evil.com")).toBe(false);
  });
  it("automated mail comes from function addresses, with replies routed to a real inbox", () => {
    expect(SENDERS.noreply.address).toBe("noreply@onesimplesite.co.uk");
    expect(SENDERS.noreply.replyTo).toBe("support@onesimplesite.co.uk");
    expect(SENDERS.legal.address).toBe("legal@onesimplesite.co.uk");
  });
});
