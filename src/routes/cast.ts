import { Elysia } from 'elysia';
import { getCastByFidAndHash, getFullCastBundle } from '../services/cast.js';
import { startTimer, logServiceMethod, logError } from '../utils/logger.js';
import { withSpan, addBreadcrumb } from '../utils/tracing.js';
import { castQuerySchema, castResponseSchema, castExamples, castFullResponseSchema } from '../schemas/cast.js';

export const castRoutes = new Elysia({ prefix: '/v1' })
  // Cast route
  .get('/cast', async ({ query }) => {
    return withSpan(
      'GET /v1/cast',
      'http.server',
      async () => {
        logServiceMethod('api', 'getCast', { query });
        addBreadcrumb('API request: GET /v1/cast', 'api', 'info', { query });
        
        try {
          const { fid, hash, fullCount } = query;

          if (!fid || !hash) {
            return { error: 'fid and hash parameters are required' };
          }

          const fidNumber = parseInt(fid as string);
          const hashString = hash as string;
          const useFullCount = fullCount === 'true' || fullCount === '1';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (!hashString.startsWith('0x') || hashString.length !== 42) {
            return { error: 'hash must be a valid hex string starting with 0x' };
          }

          const result = await getCastByFidAndHash(fidNumber, hashString, useFullCount);
          return result;
        } catch (error: any) {
          logError(error, 'api_getCast', { fid: query.fid, hash: query.hash, fullCount: query.fullCount });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/cast', query }
    );
  }, {
    query: castQuerySchema,
    response: castResponseSchema,
    detail: {
      tags: ['Cast'],
      summary: 'Get cast by FID and hash',
      description: `Retrieves a cast with all enrichments including author profile, reactions, replies, and metadata. Compatible with Neynar API response format.

**Pagination Modes:**
- **Fast (default)**: Shows up to 10K followers/reactions/replies
- **Full (fullCount=true)**: Shows complete accurate counts

**Usage:**
- Fast: Suitable for most use cases, 10K limit covers majority of users
- Full: Use when exact counts are critical (e.g., analytics, verification)`,
      examples: castExamples
    }
  })
  .get('/cast/full', async ({ query }) => {
    return withSpan(
      'GET /v1/cast/full',
      'http.server',
      async () => {
        logServiceMethod('api', 'getFullCastBundle', { query });
        addBreadcrumb('API request: GET /v1/cast/full', 'api', 'info', { query });
  
        try {
          const { fid, hash } = query;
  
          if (!fid || !hash) {
            return { error: 'fid and hash parameters are required' };
          }
  
          const fidNumber = parseInt(fid as string);
          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }
  
          const bundle = await getFullCastBundle(fidNumber, hash as string);
  
          if (!bundle) {
            return { error: 'Cast not found' };
          }
  
          return bundle;
        } catch (error: any) {
          logError(error, 'api_getFullCastBundle', { fid: query.fid, hash: query.hash });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/cast/full', query }
    );
  }, {
    query: castQuerySchema,
    response: castFullResponseSchema,
    detail: {
      tags: ['Cast'],
      summary: 'Get cast reactions and replies',
      description: `Returns the cast, its author, lists of liker/recast/replier FIDs, and follower/following info.`,
      examples: {
        example: {
          query: { fid: "123", hash: "0xabc..." },
          response: {
            cast: { hash: "0xabc...", text: "gm" },
            user: { fid: 123, username: "alice" },
            likes: { total: 2, fids: [101, 202] },
            recasts: { total: 1, fids: [303] },
            replies: { total: 1, hashes: ["0xbbb..."] },
            followers: { total: 5, fids: [11, 22, 33, 44, 55] },
            following: { total: 3, fids: [66, 77, 88] }
          }
        }
      }
    }
  });
