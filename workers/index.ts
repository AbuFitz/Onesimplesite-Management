import "dotenv/config";
import { PgBoss } from "pg-boss";
import { drainOutbox } from "../src/modules/outbox/drain";

/** Separate worker process: `npm run worker`. pg-boss schedules a minute-level drain; the loop below keeps latency low. */
async function main() {
  const boss = new PgBoss(process.env.DATABASE_URL!);
  boss.on("error", (e) => console.error("pg-boss error", e));
  await boss.start();
  await boss.createQueue("outbox-drain");
  await boss.schedule("outbox-drain", "* * * * *");
  await boss.work("outbox-drain", async () => { const r = await drainOutbox(); if (r.claimed) console.log("outbox", r); });
  setInterval(() => drainOutbox().then((r) => r.claimed && console.log("outbox", r)).catch(console.error), 5000);
  console.log("worker started");
}
main().catch((e) => { console.error(e); process.exit(1); });
