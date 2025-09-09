import redis from "./redis.js";

export interface FollowerData {
  fid: number;
  followerCount: number;
  followingCount: number;
  lastUpdated: number;
}

export async function getCachedFollowerCount(fid: number): Promise<FollowerData | null> {
  try {
    const key = `FOLLOW_COUNT:${fid}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error retrieving cached follower count for FID ${fid}:`, error);
    return null;
  }
}

export async function getCachedFollowers(fid: number): Promise<number[] | null> {
  try {
    const key = `FOLLOWERS:${fid}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error retrieving cached followers for FID ${fid}:`, error);
    return null;
  }
}

export async function getCachedFollowing(fid: number): Promise<number[] | null> {
  try {
    const key = `FOLLOWING:${fid}`;
    const data = await redis.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error retrieving cached following for FID ${fid}:`, error);
    return null;
  }
}
