import Redis from 'ioredis';

export class RedisService {
  private client: Redis;
  private static instance: RedisService;
  private readonly TTL = 3600; // 1 hour in seconds
  private readonly KEY_PREFIX = 'fid';

  private constructor() {
    this.client = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      db: parseInt(process.env.REDIS_DB || '0'),
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.client.on('error', (err) => {
      console.error('Redis Client Error:', err);
    });
  }

  public static getInstance(): RedisService {
    if (!RedisService.instance) {
      RedisService.instance = new RedisService();
    }
    return RedisService.instance;
  }

  private getKey(fid: string | number): string {
    return `${this.KEY_PREFIX}:${fid}`;
  }

  async setFidHash(fid: string | number, hash: string, ttl?: number): Promise<void> {
    const key = this.getKey(fid);
    const ttlToUse = ttl !== undefined ? ttl : this.TTL;
    await this.client.set(key, hash, 'EX', ttlToUse);
  }

  async getFidHash(fid: string | number): Promise<string | null> {
    const key = this.getKey(fid);
    return this.client.get(key);
  }

  async deleteFidHash(fid: string | number): Promise<number> {
    const key = this.getKey(fid);
    return this.client.del(key);
  }

  async clearCache(): Promise<string> {
    return this.client.flushdb();
  }

  async disconnect(): Promise<void> {
    await this.client.quit();
  }
}

export const redisService = RedisService.getInstance();
