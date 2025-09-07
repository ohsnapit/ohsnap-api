import { Worker, Queue } from "bullmq";
import redis from "../utils/redis.js";

const HTTP_HOST = process.env.HTTP_HOST || "";
const CACHE_TTL = 60 * 60 * 24;
const DEFAULT_PAGE_SIZE = 10000;

interface FollowerData {
  fid: number;
  followerCount: number;
  followingCount: number;
  lastUpdated: number;
}

async function fetchAllFidsFromSnapchain(): Promise<number[]> {
  try {
    const response = await fetch(`${HTTP_HOST}/v1/info`, {
      headers: {
        'User-Agent': 'OhSnap-API/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json() as any;
    const totalFidRegistrations = data.dbStats.numFidRegistrations;
    
    // Generate array of FIDs from 1 to totalFidRegistrations
    const fids: number[] = [];
    for (let fid = 1; fid <= totalFidRegistrations; fid++) {
      fids.push(fid);
    }
    
    console.log(`Generated ${fids.length} FIDs from 1 to ${totalFidRegistrations}`);
    return fids;
  } catch (error) {
    console.error("Error fetching FIDs from Snapchain:", error);
    throw error;
  }
}

async function getAllFollowers(fid: number): Promise<number[]> {
  const followers: number[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    try {
      const url = new URL(`${HTTP_HOST}/v1/linksByTargetFid`);
      url.searchParams.set("target_fid", fid.toString());
      url.searchParams.set("link_type", "follow");
      url.searchParams.set("pageSize", DEFAULT_PAGE_SIZE.toString());
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'OhSnap-API/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`HTTP error fetching followers for FID ${fid}: ${response.status}`);
        break;
      }

      const data = await response.json() as any;
      const messages = data.messages || [];
      
      for (const message of messages) {
        if (message.data?.linkBody?.type === "follow" && message.data?.fid) {
          followers.push(message.data.fid);
        }
      }

      pageToken = data.nextPageToken || "";
      // Check if nextPageToken is a valid pagination token (not "[null,null]" or its base64 encoding which means no more pages)
      const isEndToken = pageToken === "[null,null]" || pageToken === "W251bGwsbnVsbF0=";
      hasMore = pageToken.length > 0 && !isEndToken;
      
      console.log(`Fetched ${messages.length} follower links for FID ${fid} (requested: ${DEFAULT_PAGE_SIZE}, total: ${followers.length}, nextPageToken: "${pageToken}", hasMore: ${hasMore})`);
    } catch (error) {
      console.error(`Error in pagination for followers of FID ${fid}:`, error);
      break;
    }
  }

  return followers;
}

async function getAllFollowing(fid: number): Promise<number[]> {
  const following: number[] = [];
  let pageToken = "";
  let hasMore = true;

  while (hasMore) {
    try {
      const url = new URL(`${HTTP_HOST}/v1/linksByFid`);
      url.searchParams.set("fid", fid.toString());
      url.searchParams.set("link_type", "follow");
      url.searchParams.set("pageSize", DEFAULT_PAGE_SIZE.toString());
      if (pageToken) {
        url.searchParams.set("pageToken", pageToken);
      }

      const response = await fetch(url.toString(), {
        headers: {
          'User-Agent': 'OhSnap-API/1.0'
        }
      });
      
      if (!response.ok) {
        console.error(`HTTP error fetching following for FID ${fid}: ${response.status}`);
        break;
      }

      const data = await response.json() as any;
      const messages = data.messages || [];
      
      for (const message of messages) {
        if (message.data?.linkBody?.type === "follow" && message.data?.linkBody?.targetFid) {
          following.push(message.data.linkBody.targetFid);
        }
      }

      pageToken = data.nextPageToken || "";
      // Check if nextPageToken is a valid pagination token (not "[null,null]" or its base64 encoding which means no more pages)
      const isEndToken = pageToken === "[null,null]" || pageToken === "W251bGwsbnVsbF0=";
      hasMore = pageToken.length > 0 && !isEndToken;
      
      console.log(`Fetched ${messages.length} following links for FID ${fid} (requested: ${DEFAULT_PAGE_SIZE}, total: ${following.length}, nextPageToken: "${pageToken}", hasMore: ${hasMore})`);
    } catch (error) {
      console.error(`Error in pagination for following of FID ${fid}:`, error);
      break;
    }
  }

  return following;
}

async function cacheFollowerData(fid: number): Promise<void> {
  try {
    console.log(`Starting follower/following backfill for FID ${fid}`);
    
    const [followers, following] = await Promise.all([
      getAllFollowers(fid),
      getAllFollowing(fid)
    ]);

    const followerData: FollowerData = {
      fid,
      followerCount: followers.length,
      followingCount: following.length,
      lastUpdated: Date.now()
    };

    const countKey = `FOLLOW_COUNT:${fid}`;
    await redis.set(countKey, JSON.stringify(followerData)); //indefenite TTl

    const followersKey = `FOLLOWERS:${fid}`;
    await redis.set(followersKey, JSON.stringify(followers)); //indefenite TTl

    const followingKey = `FOLLOWING:${fid}`;
    await redis.set(followingKey, JSON.stringify(following)); //indefenite TTl

    console.log(`Cached follower data for FID ${fid}: ${followerData.followerCount} followers, ${followerData.followingCount} following`);
  } catch (error) {
    console.error(`Failed to cache follower data for FID ${fid}:`, error);
    throw error;
  }
}

async function processFidBatch(fids: number[]): Promise<void> {
  const results = await Promise.allSettled(
    fids.map(async (fid) => {
      try {
        await cacheFollowerData(fid);
        return { fid, success: true };
      } catch (error) {
        console.error(`Failed to process FID ${fid}:`, error);
        return { fid, success: false, error };
      }
    })
  );
  
  const successful = results.filter(r => r.status === 'fulfilled' && r.value.success).length;
  const failed = results.length - successful;
  
  console.log(`Batch completed: ${successful} successful, ${failed} failed out of ${fids.length} FIDs`);
}

new Worker(
  "followers-backfill",
  async (job) => {
    if (job.name === "createBatches") {
      console.log(`Creating batch jobs for followers backfill`);
      
      const allFids = await fetchAllFidsFromSnapchain();
      console.log(`Creating batch jobs for ${allFids.length} FIDs`);

      const BATCH_SIZE = 100;
      const batches: number[][] = [];
      
      for (let i = 0; i < allFids.length; i += BATCH_SIZE) {
        batches.push(allFids.slice(i, i + BATCH_SIZE));
      }
      
      console.log(`Created ${batches.length} batches of ${BATCH_SIZE} FIDs each`);
      
      // Create queue instance directly to avoid importing queue file
      const batchQueue = new Queue("followers-backfill", {
        connection: { host: "127.0.0.1", port: 16379 },
      });
      
      for (let i = 0; i < batches.length; i++) {
        await batchQueue.add(`processBatch-${i + 1}`, {
          batchNumber: i + 1,
          fids: batches[i],
          totalBatches: batches.length
        });
      }
      
      console.log(`Enqueued ${batches.length} batch processing jobs`);
    } 
    else if (job.name.startsWith("processBatch-")) {
      const { batchNumber, fids, totalBatches } = job.data;
      console.log(`Processing batch ${batchNumber}/${totalBatches} with ${fids.length} FIDs`);
      
      await processFidBatch(fids);
      
      console.log(`Completed batch ${batchNumber}/${totalBatches}`);
    }
  },
  { 
    connection: { host: "127.0.0.1", port: 16379 },
    concurrency: 10
  }
);

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