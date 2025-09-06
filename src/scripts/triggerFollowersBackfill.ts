import { Queue } from "bullmq";

// Create a one-time script to trigger followers backfill
const queue = new Queue("followers-backfill", {
  connection: { host: "127.0.0.1", port: 6379 },
});

console.log("Triggering followers backfill job...");

try {
  await queue.add("createBatches", {});
  console.log("Successfully created followers backfill job");
} catch (error) {
  console.error("Failed to create followers backfill job:", error);
  process.exit(1);
}

// Close the queue connection and exit
await queue.close();
console.log("Done");
process.exit(0);