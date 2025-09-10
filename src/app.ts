import './instrument.js';
import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { getCastByFidAndHash, getEnrichedUserProfile, getCastsByFid } from './services/cast.js';
import { getOnChainSignersByFidSimple, getOnChainEventsByFidSimple, getReactionsByFid, getLinksByFid, getLinksByTargetFid, getVerificationsByFid } from './services/http.js';
import { API_PORT } from './utils/constants.js';
import { startTimer, logServiceMethod, logError } from './utils/logger.js';
import { openApiConfig } from './config/openapi.js';
import { withSpan, addBreadcrumb } from './utils/tracing.js';
import { getFidByUsername } from './services/usernameCache.ts'

// Schemas
import { castQuerySchema, castResponseSchema, castExamples } from './schemas/cast.js';
import { usernameQuerySchema, userQuerySchema, userResponseSchema, userExamples, userCastsQuerySchema, userCastsResponseSchema, userCastsExamples } from './schemas/user.js';
import { healthResponseSchema } from './schemas/health.js';
import { onchainSignersQuerySchema, onchainSignersResponseSchema, onchainSignersExamples, onchainEventsQuerySchema, onchainEventsResponseSchema, onchainEventsExamples } from './schemas/onchain.js';
import { reactionsByFidQuerySchema, reactionsByFidResponseSchema, reactionsByFidExamples } from './schemas/reactions.js';
import { linksByFidQuerySchema, linksByFidResponseSchema, linksByFidExamples, linksByTargetFidQuerySchema, linksByTargetFidResponseSchema, linksByTargetFidExamples } from './schemas/links.js';
import { verificationsByFidQuerySchema, verificationsByFidResponseSchema, verificationsByFidExamples } from './schemas/verifications.js';

const app = new Elysia()
  .use(openapi(openApiConfig))
  // Cast route
  .get('/v1/cast', async ({ query }) => {
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
  // User profile route
  .get('/v1/user', async ({ query }) => {
    return withSpan(
      'GET /v1/user',
      'http.server',
      async () => {
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
          return result;
        } catch (error: any) {
          logError(error, 'api_getUser', { fid: query.fid, fullCount: query.fullCount });
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
      'GET /v1/user/casts',
      'http.server',
      async () => {
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
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getUserCasts', { 
            fid: query.fid, 
            cursor: query.cursor, 
            limit: query.limit, 
            fullCount: query.fullCount, 
            include_replies: query.include_replies 
          });
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
    'GET /v1/user/by-username',
    'http.server',
    async () => {
      logServiceMethod('api', 'getUserByUsername', { query });
      addBreadcrumb('API request: GET /v1/user/by-username', 'api', 'info', { query });

      try {
        const { username, fullCount } = query;
        if (!username) {
          return { error: 'username parameter is required' };
        }

        // const { getFidByUsername } = await import('./services/usernameCache.ts');
        // const { getEnrichedUserProfile } = await import('./services/cast.ts');
        // Check cache
        const fid = await getFidByUsername(username);
        console.log(`fid ${fid}`)
        if (!fid) {
          return { error: `FID not found for username: ${username}` };
        }

        // Fetch enriched profile
        const useFullCount = fullCount === 'true' || fullCount === '1';
        const user = await getEnrichedUserProfile(fid, useFullCount);

        const result = { users: [user], next: { cursor: null } };
        return result;
      } catch (error: any) {
        logError(error, 'api_getUserByUsername', { username: query.username, fullCount: query.fullCount });
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
- /v1/user/by-username?username=foo
- /v1/user/by-username?username=foo&fullCount=true`,
    examples: {
      foo: {
        username: "foo",
        response: {
          users: [{ fid: 123, username: "foo", display_name: "bar" }],
          next: { cursor: null }
        }
      }
    }
  }
})

  // Onchain signers by FID route
  .get('/v1/onChainSignersByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/onChainSignersByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getOnChainSignersByFid', { query });
        addBreadcrumb('API request: GET /v1/onChainSignersByFid', 'api', 'info', { query });
        
        try {
          const { fid, signer } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidNumber = parseInt(fid as string);

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          const result = await getOnChainSignersByFidSimple(
            fidNumber,
            signer as string
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getOnChainSignersByFid', { 
            fid: query.fid, 
            signer: query.signer
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/onChainSignersByFid', query }
    );
  }, {
    query: onchainSignersQuerySchema,
    response: onchainSignersResponseSchema,
    detail: {
      tags: ['Onchain'],
      summary: 'Get onchain signers by FID',
      description: `Get a list of account keys (signers) provided by an FID.

**Parameters:**
- **fid** (required): The Farcaster ID being requested
- **signer** (optional): The optional key of signer

**Response Format:**
- Contains an "events" array with detailed on-chain signer information
- Each event includes blockchain metadata (block number, hash, timestamp, transaction hash)
- Signer event details (key, key type, event type, metadata)

**Usage:**
- Basic: Get all signer events for a FID
- Filtered: Get events for a specific signer key`,
      examples: onchainSignersExamples
    }
  })

  // Onchain events by FID route
  .get('/v1/onChainEventsByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/onChainEventsByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getOnChainEventsByFid', { query });
        addBreadcrumb('API request: GET /v1/onChainEventsByFid', 'api', 'info', { query });
        
        try {
          const { fid, event_type } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          if (!event_type) {
            return { error: 'event_type parameter is required' };
          }

          const fidNumber = parseInt(fid as string);

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          const result = await getOnChainEventsByFidSimple(
            fidNumber,
            event_type as string
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getOnChainEventsByFid', { 
            fid: query.fid, 
            event_type: query.event_type
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/onChainEventsByFid', query }
    );
  }, {
    query: onchainEventsQuerySchema,
    response: onchainEventsResponseSchema,
    detail: {
      tags: ['Onchain'],
      summary: 'Get onchain events by FID',
      description: `Get a list of on-chain events provided by an FID.

**Parameters:**
- **fid** (required): The FID being requested
- **event_type** (required): The string value of the event type being requested

**Available Event Types:**
- EVENT_TYPE_NONE
- EVENT_TYPE_SIGNER
- EVENT_TYPE_SIGNER_MIGRATED  
- EVENT_TYPE_ID_REGISTER
- EVENT_TYPE_STORAGE_RENT
- EVENT_TYPE_TIER_PURCHASE

**Response Format:**
- Contains an "events" array with detailed on-chain event information
- Each event includes blockchain metadata (block number, hash, timestamp, transaction hash)
- Event-specific details based on event type (signer, ID register, etc.)

**Usage:**
- Get signer events: event_type=EVENT_TYPE_SIGNER
- Get ID register events: event_type=EVENT_TYPE_ID_REGISTER
- Get storage rent events: event_type=EVENT_TYPE_STORAGE_RENT`,
      examples: onchainEventsExamples
    }
  })

  // Reactions by FID route
  .get('/v1/reactionsByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/reactionsByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getReactionsByFid', { query });
        addBreadcrumb('API request: GET /v1/reactionsByFid', 'api', 'info', { query });
        
        try {
          const { fid, reaction_type, pageSize, pageToken, reverse } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          if (!reaction_type) {
            return { error: 'reaction_type parameter is required' };
          }

          const fidNumber = parseInt(fid as string);
          const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 1000;
          const reverseFlag = reverse === 'true';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
            return { error: 'pageSize must be a valid positive number' };
          }

          const result = await getReactionsByFid(
            fidNumber,
            reaction_type as string,
            pageSizeNumber,
            pageToken as string,
            reverseFlag
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getReactionsByFid', { 
            fid: query.fid, 
            reaction_type: query.reaction_type,
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            reverse: query.reverse
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/reactionsByFid', query }
    );
  }, {
    query: reactionsByFidQuerySchema,
    response: reactionsByFidResponseSchema,
    detail: {
      tags: ['Reactions'],
      summary: 'Get all reactions by an FID',
      description: `Get all reactions by an FID with pagination support.

**Parameters:**
- **fid** (required): The FID of the reaction's creator
- **reaction_type** (required): The type of reaction (Like or Recast)
- **pageSize** (optional): Page size, defaults to 1000
- **pageToken** (optional): Pagination token for next page
- **reverse** (optional): Reverse order flag (true/false)

**Available Reaction Types:**
- Like: Like the target cast
- Recast: Share target cast to the user's audience

**Response Format:**
- Contains a "messages" array with detailed reaction information
- Each message includes data, hash, signature, and signer information
- Pagination support with nextPageToken

**Usage:**
- Get likes: reaction_type=Like
- Get recasts: reaction_type=Recast
- Paginated: Use pageToken for loading more results`,
      examples: reactionsByFidExamples
    }
  })

  // Links by FID route
  .get('/v1/linksByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/linksByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getLinksByFid', { query });
        addBreadcrumb('API request: GET /v1/linksByFid', 'api', 'info', { query });
        
        try {
          const { fid, link_type, pageSize, pageToken, reverse } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidNumber = parseInt(fid as string);
          const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 1000;
          const reverseFlag = reverse === 'true';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
            return { error: 'pageSize must be a valid positive number' };
          }

          const result = await getLinksByFid(
            fidNumber,
            link_type as string,
            pageSizeNumber,
            pageToken as string,
            reverseFlag
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getLinksByFid', { 
            fid: query.fid, 
            link_type: query.link_type,
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            reverse: query.reverse
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/linksByFid', query }
    );
  }, {
    query: linksByFidQuerySchema,
    response: linksByFidResponseSchema,
    detail: {
      tags: ['Links'],
      summary: 'Get all links by an FID',
      description: `Get all links by an FID with pagination support.

**Parameters:**
- **fid** (required): The FID of the link's creator
- **link_type** (optional): The type of link (e.g., "follow")
- **pageSize** (optional): Page size, defaults to 1000
- **pageToken** (optional): Pagination token for next page
- **reverse** (optional): Reverse order flag (true/false)

**Common Link Types:**
- follow: Follow relationships between users

**Response Format:**
- Contains a "messages" array with detailed link information
- Each message includes data, hash, signature, and signer information
- Link body contains type, displayTimestamp, and targetFid
- Pagination support with nextPageToken

**Usage:**
- Get all links: Just provide fid
- Get follow links: link_type=follow
- Paginated: Use pageToken for loading more results`,
      examples: linksByFidExamples
    }
  })

  // Links by target FID route (followers)
  .get('/v1/linksByTargetFid', async ({ query }) => {
    return withSpan(
      'GET /v1/linksByTargetFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getLinksByTargetFid', { query });
        addBreadcrumb('API request: GET /v1/linksByTargetFid', 'api', 'info', { query });
        
        try {
          const { target_fid, link_type, pageSize, pageToken, reverse } = query;

          if (!target_fid) {
            return { error: 'target_fid parameter is required' };
          }

          const targetFidNumber = parseInt(target_fid as string);
          const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 1000;
          const reverseFlag = reverse === 'true';

          if (isNaN(targetFidNumber)) {
            return { error: 'target_fid must be a valid number' };
          }

          if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
            return { error: 'pageSize must be a valid positive number' };
          }

          const result = await getLinksByTargetFid(
            targetFidNumber,
            link_type as string,
            pageSizeNumber,
            pageToken as string,
            reverseFlag
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getLinksByTargetFid', { 
            target_fid: query.target_fid, 
            link_type: query.link_type,
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            reverse: query.reverse
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/linksByTargetFid', query }
    );
  }, {
    query: linksByTargetFidQuerySchema,
    response: linksByTargetFidResponseSchema,
    detail: {
      tags: ['Links'],
      summary: 'Get all followers of an FID',
      description: `Get all users following a specific FID with pagination support.

**Parameters:**
- **target_fid** (required): The FID of the target user (who is being followed)
- **link_type** (optional): The type of link (e.g., "follow")
- **pageSize** (optional): Page size, defaults to 1000
- **pageToken** (optional): Pagination token for next page
- **reverse** (optional): Reverse order flag (true/false)

**Common Link Types:**
- follow: Follow relationships targeting this user

**Response Format:**
- Contains a "messages" array with detailed link information
- Each message includes data, hash, signature, and signer information
- Link body contains type, displayTimestamp, and targetFid
- Pagination support with nextPageToken

**Usage:**
- Get all followers: Just provide target_fid
- Get follow links to user: link_type=follow
- Paginated: Use pageToken for loading more results`,
      examples: linksByTargetFidExamples
    }
  })

  // Verifications by FID route
  .get('/v1/verificationsByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/verificationsByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getVerificationsByFid', { query });
        addBreadcrumb('API request: GET /v1/verificationsByFid', 'api', 'info', { query });
        
        try {
          const { fid, pageSize, pageToken, reverse } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidNumber = parseInt(fid as string);
          const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 1000;
          const reverseFlag = reverse === 'true';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
            return { error: 'pageSize must be a valid positive number' };
          }

          const result = await getVerificationsByFid(
            fidNumber,
            pageSizeNumber,
            pageToken as string,
            reverseFlag
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getVerificationsByFid', { 
            fid: query.fid, 
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            reverse: query.reverse
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/verificationsByFid', query }
    );
  }, {
    query: verificationsByFidQuerySchema,
    response: verificationsByFidResponseSchema,
    detail: {
      tags: ['Verifications'],
      summary: 'Get all verifications by an FID',
      description: `Get all address verifications by an FID with pagination support.

**Parameters:**
- **fid** (required): The FID of the verification's creator
- **pageSize** (optional): Page size, defaults to 1000
- **pageToken** (optional): Pagination token for next page
- **reverse** (optional): Reverse order flag (true/false)

**Response Format:**
- Contains a "messages" array with detailed verification information
- Each message includes data, hash, signature, and signer information
- Verification body contains address, claimSignature, blockHash, type, chainId, and protocol
- Pagination support with nextPageToken

**Supported Protocols:**
- PROTOCOL_ETHEREUM: Ethereum address verifications
- PROTOCOL_SOLANA: Solana address verifications

**Usage:**
- Get all verifications: Just provide fid
- Paginated: Use pageToken for loading more results`,
      examples: verificationsByFidExamples
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
