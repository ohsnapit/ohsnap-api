import redis from "../utils/redis";

const TTL_SECONDS = 60 * 60 * 24; // 24h

export async function setUsernameFid(username: string, fid: number) {
  const key = `USERNAME:${username.toLowerCase()}`;
  await redis.set(key, fid.toString(), { EX: TTL_SECONDS });
}

export async function getFidByUsername(username: string): Promise<number | null> {
  console.log("in here")
  const key = `X_USERNAME:${username.toLowerCase()}`;
  const fidStr = await redis.get(key);
  console.log(`fidstr ${fidStr}`)
  return fidStr ? parseInt(fidStr, 10) : null;
}

// Placeholder for later use
export async function resolveFidFromUsername(username: string): Promise<number | null> {
  // For now, skip external lookups
  return null;
}
