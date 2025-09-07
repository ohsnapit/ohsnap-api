import { Queue } from "bullmq";

export const cacheWarmQueue = new Queue("cache-warm", {
  connection: { host: "127.0.0.1", port: 16379 },
});

// This just enqueues "warmUsers" without any payload
// await cacheWarmQueue.add(
//   "warmUsers",
//   {}, // no usernames, worker handles API fetch
//   { repeat: { pattern: "0 */6 * * *" } } // every 6 hours
// );



if (process.env.NODE_ENV === "production") {
    // scheduled
    await cacheWarmQueue.add("warmUsers", {}, { repeat: { pattern: "0 */6 * * *" } });
  } else {
    // immediate run for testing
    console.log("not production")
    await cacheWarmQueue.add("warmUsers", {});
  }
  