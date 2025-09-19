import { Elysia } from 'elysia';
import { withSpan, addBreadcrumb } from "../utils/tracing.js";
import { logServiceMethod, logError } from "../utils/logger.js";
import { getEnrichedUserProfile, getCastsByFid } from '../services/cast.js';
import { userQuerySchema, userResponseSchema, userExamples, usernameQuerySchema, userCastsQuerySchema, userCastsResponseSchema, userCastsExamples } from '../schemas/user.js';
import { getFidByUsername } from '../services/usernameCache.js';


export const userRoutes = new Elysia()
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