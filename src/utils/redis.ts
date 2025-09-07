// utils/redis.ts
import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL || "redis://localhost:16379";

const redis = createClient({
  url: redisUrl,
});

redis.on("error", (err) => {
  console.error("❌ Redis Client Error", err);
});

await redis.connect();

console.log(`✅ Connected to Redis at ${redisUrl}`);

export default redis;
