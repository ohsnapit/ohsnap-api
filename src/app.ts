import './instrument.js';
import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { getCastByFidAndHash, getEnrichedUserProfile, getCastsByFid } from './services/cast.js';
import { API_PORT } from './utils/constants.js';
import { startTimer, logServiceMethod, logError } from './utils/logger.js';
import { openApiConfig } from './config/openapi.js';
import { withSpan, addBreadcrumb } from './utils/tracing.js';

// Schemas
import { castQuerySchema, castResponseSchema, castExamples } from './schemas/cast.js';
import { usernameQuerySchema, userQuerySchema, userResponseSchema, userExamples, userCastsQuerySchema, userCastsResponseSchema, userCastsExamples } from './schemas/user.js';
import { healthResponseSchema } from './schemas/health.js';

const app = new Elysia()
  .use(openapi(openApiConfig))
  // Cast route
  .get('/v1/cast', async ({ query }) => {
    return withSpan(
      'api.cast.get',
      'Get cast by FID and hash',
      async () => {
        const timer = startTimer('api_cast', { endpoint: '/v1/cast' });
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
          timer.end({ success: true, fid: fidNumber });
          return result;
        } catch (error: any) {
          logError(error, 'api_getCast', { fid: query.fid, hash: query.hash, fullCount: query.fullCount });
          timer.end({ error: error.message });
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
  // User profile route
  .get('/v1/user', async ({ query }) => {
    return withSpan(
      'api.user.get',
      'Get user profiles by FID(s)',
      async () => {
        const timer = startTimer('api_user', { endpoint: '/v1/user' });
        logServiceMethod('api', 'getUser', { query });
        addBreadcrumb('API request: GET /v1/user', 'api', 'info', { query });
        
        try {
          const { fid, fullCount } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidStrings = (fid as string).split(',').map(f => f.trim());
          const useFullCount = fullCount === 'true' || fullCount === '1';

          const fidNumbers: number[] = [];
          for (const fidStr of fidStrings) {
            const fidNumber = parseInt(fidStr);
            if (isNaN(fidNumber)) {
              return { error: `Invalid fid: ${fidStr}. All FIDs must be valid numbers.` };
            }
            fidNumbers.push(fidNumber);
          }

          const users = await Promise.all(
            fidNumbers.map(fidNumber => getEnrichedUserProfile(fidNumber, useFullCount))
          );

          const result = { users, next: { cursor: null } };
          timer.end({ success: true, userCount: users.length });
          return result;
        } catch (error: any) {
          logError(error, 'api_getUser', { fid: query.fid, fullCount: query.fullCount });
          timer.end({ error: error.message });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/user', query }
    );
  }, {
    query: userQuerySchema,
    response: userResponseSchema,
    detail: {
      tags: ['User'],
      summary: 'Get user profiles by FID(s)',
      description: `Retrieves user profiles with all enrichments including follower counts, verifications, and metadata. Compatible with Neynar API response format.

**Bulk Support:**
- Single user: fid=3
- Multiple users: fid=3,2,9

**Pagination Modes:**
- **Fast (default)**: Shows up to 10K followers/following
- **Full (fullCount=true)**: Shows complete accurate counts

**Usage:**
- Fast: Suitable for most use cases, 10K limit covers majority of users
- Full: Use when exact counts are critical (e.g., analytics, verification)`,
      examples: userExamples
    }
  })
  // User casts route
  .get('/v1/user/casts', async ({ query }) => {
    return withSpan(
      'api.user.casts.get',
      'Get user casts with pagination',
      async () => {
        const timer = startTimer('api_user_casts', { endpoint: '/v1/user/casts' });
        logServiceMethod('api', 'getUserCasts', { query });
        addBreadcrumb('API request: GET /v1/user/casts', 'api', 'info', { query });
        
        try {
          const { fid, cursor, limit, fullCount, include_replies } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidNumber = parseInt(fid as string);
          const useFullCount = fullCount === 'true' || fullCount === '1';
          const pageSize = limit ? parseInt(limit as string) : 25;
          const includeReplies = include_replies !== 'false';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (pageSize < 1 || pageSize > 150) {
            return { error: 'limit must be between 1 and 150' };
          }

          const result = await getCastsByFid(
            fidNumber,
            cursor as string,
            pageSize,
            useFullCount,
            includeReplies
          );
          
          timer.end({ success: true, fid: fidNumber, castsCount: result.casts.length });
          return result;
        } catch (error: any) {
          logError(error, 'api_getUserCasts', { 
            fid: query.fid, 
            cursor: query.cursor, 
            limit: query.limit, 
            fullCount: query.fullCount, 
            include_replies: query.include_replies 
          });
          timer.end({ error: error.message });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/user/casts', query }
    );
  }, {
    query: userCastsQuerySchema,
    response: userCastsResponseSchema,
    detail: {
      tags: ['User'],
      summary: 'Get user casts',
      description: `Fetch casts for a given user FID in reverse chronological order (newest first). Compatible with Neynar API response format.

**Pagination:**
- **cursor**: Pagination cursor for next page
- **limit**: Number of casts to return (1-150, default: 25)

**Pagination Modes:**
- **Fast (default)**: Shows up to 10K followers/reactions/replies per cast
- **Full (fullCount=true)**: Shows complete accurate counts per cast

**Usage:**
- Basic: Get latest casts from a user (newest first)
- Paginated: Use cursor for loading more results`,
      examples: userCastsExamples
    }
  })
  // User by username route
.get('/v1/user/by-username', async ({ query }) => {
  return withSpan(
    'api.user.byUsername',
    'Get user profile by username',
    async () => {
      const timer = startTimer('api_user_by_username', { endpoint: '/v1/user/by-username' });
      logServiceMethod('api', 'getUserByUsername', { query });
      addBreadcrumb('API request: GET /v1/user/by-username', 'api', 'info', { query });

      try {
        const { username, fullCount } = query;
        if (!username) {
          return { error: 'username parameter is required' };
        }

        const { getFidByUsername } = await import('./services/usernameCache.ts');
        const { getEnrichedUserProfile } = await import('./services/cast.ts');

        // Step 1: Only check cache
        const fid = await getFidByUsername(username);
        if (!fid) {
          return { error: `FID not found in cache for username: ${username}` };
        }

        // Step 2: Fetch enriched profile
        const useFullCount = fullCount === 'true' || fullCount === '1';
        const user = await getEnrichedUserProfile(fid, useFullCount);

        const result = { users: [user], next: { cursor: null } };
        timer.end({ success: true, fid, username });
        return result;
      } catch (error: any) {
        logError(error, 'api_getUserByUsername', { username: query.username, fullCount: query.fullCount });
        timer.end({ error: error.message });
        return { error: 'Internal server error', details: error.message };
      }
    },
    { endpoint: '/v1/user/by-username', query }
  );
}, {
  query: usernameQuerySchema,
  response: userResponseSchema,
  detail: {
    tags: ['User'],
    summary: 'Get user profile by X username',
    description: `Fetches a user's profile by resolving their Xusername to fid (via cache only).

**Usage:**
- /v1/user/by-username?username=jack
- /v1/user/by-username?username=jack&fullCount=true`,
    examples: {
      jack: {
        username: "jack",
        response: {
          users: [{ fid: 2, username: "jack", display_name: "Jack" }],
          next: { cursor: null }
        }
      }
    }
  }
})

  // Health route
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }), {
    response: healthResponseSchema,
    detail: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the current status and timestamp of the API server'
    }
  });

// Start server
const port = process.env.PORT || API_PORT;
app.listen(port);
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
