import { after } from "next/server";

/** Send queued emails right after the response, so nobody has to run anything by hand. A daily cron retries leftovers. */
export function flushEmails() {
  after(async () => {
    try {
      const { drainOutbox } = await import("@/modules/outbox/drain");
      await drainOutbox();
    } catch (e) {
      console.error("email flush failed", String(e).slice(0, 200));
    }
  });
}
