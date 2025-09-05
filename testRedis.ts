// testRedis.ts
import Redis from "ioredis";

const redis = new Redis();

await redis.set("FID:12345", "deadbeef123", "EX", 60);
const val = await redis.get("FID:12345");

console.log("Fetched from Redis:", val);
await redis.quit();
