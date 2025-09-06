import { Worker } from "bullmq";
import { setUsernameFid } from "../services/usernameCache.ts";

// Replace this with Snapchain API call
async function fetchAllUsers(): Promise<{ username: string; fid: number }[]> {
//   const res = await fetch("https://snapchain.example.com/api/users");
//   const data = await res.json();

// Adding a manual list for now, need to modify it to an actual list from snapchain
    const data = [
        { username: "abdfsdfd", fid: 1234 }, 
        { username: "whatever", fid: 29 },
        { username: "vhawk", fid: 980 },
        { username: "foo", fid: 164 },
        { username: "bar", fid: 165 }
    ];
  // shape to { username, fid }
  return data;
}

new Worker(
  "cache-warm",
  async (job) => {
    console.log(`🛠 Running job: ${job.name}`);

    const users = await fetchAllUsers();
    console.log(`📥 Got ${users.length} users from API`);

    for (const { username, fid } of users) {
      if (username && fid) {
        await setUsernameFid(username, fid);
        console.log(`✅ Cached ${username} → ${fid}`);
      }
    }
  },
  { connection: { host: "127.0.0.1", port: 6379 } }
);

// To trigger a job and run it immediately
// bun run src/jobs/cacheWarm.worker.ts
// bun run src/queues/cacheWarm.queue.ts
