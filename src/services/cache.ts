import { redisService } from './redis';

export class CacheService {
  private static instance: CacheService;

  private constructor() {}

  public static getInstance(): CacheService {
    if (!CacheService.instance) {
      CacheService.instance = new CacheService();
    }
    return CacheService.instance;
  }

  /**
   * Get cached hash for a given FID
   * @param fid Farcaster ID
   * @returns Cached hash or null if not found
   */
  async getFidHash(fid: string | number): Promise<string | null> {
    try {
      return await redisService.getFidHash(fid);
    } catch (error) {
      console.error('Error getting FID hash from cache:', error);
      return null; // Fail silently and fall back to gRPC
    }
  }

  /**
   * Cache a hash for a given FID
   * @param fid Farcaster ID
   * @param hash The hash to cache
   * @param ttl Time to live in seconds (optional, defaults to 1 hour)
   */
  async setFidHash(fid: string | number, hash: string, ttl?: number): Promise<void> {
    try {
      await redisService.setFidHash(fid, hash, ttl);
    } catch (error) {
      console.error('Error setting FID hash in cache:', error);
      // Fail silently - we can still continue without caching
    }
  }

  /**
   * Invalidate cache for a specific FID
   * @param fid Farcaster ID to invalidate
   */
  async invalidateFid(fid: string | number): Promise<void> {
    try {
      await redisService.deleteFidHash(fid);
    } catch (error) {
      console.error('Error invalidating FID cache:', error);
    }
  }

  /**
   * Clear the entire cache (use with caution)
   */
  async clearCache(): Promise<void> {
    try {
      await redisService.clearCache();
    } catch (error) {
      console.error('Error clearing cache:', error);
      throw error; // This might be important to handle
    }
  }
}

export const cacheService = CacheService.getInstance();
