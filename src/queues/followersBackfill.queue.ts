import { Queue } from "bullmq";

export const followersBackfillQueue = new Queue("followers-backfill", {
  connection: { host: "127.0.0.1", port: 6379 },
});

if (process.env.NODE_ENV === "production") {
  await followersBackfillQueue.add("createBatches", {}, { repeat: { pattern: "0 */12 * * *" } });
} else {
  console.log("not production, creating batch jobs immediately");
  await followersBackfillQueue.add("createBatches", {});
}