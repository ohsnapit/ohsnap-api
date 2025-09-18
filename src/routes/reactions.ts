import Elysia from "elysia";
import { withSpan, addBreadcrumb } from "../utils/tracing.js";
import { logServiceMethod, logError } from "../utils/logger.js";
import { getReactionsByFid, getReactionsByCast, getReactionsByTarget } from "../services/http.js";
import { reactionsByFidQuerySchema, reactionsByFidResponseSchema, reactionsByFidExamples, reactionsByCastQuerySchema, reactionsByCastExamples, reactionsByTargetQuerySchema, reactionsByTargetExamples } from "../schemas/reactions.js";



export const reactionRoutes = new Elysia()
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

                    // Ensure messages array is always defined to match schema
                    return {
                        messages: result.messages || [],
                        nextPageToken: result.nextPageToken
                    };
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

    // Reactions by Cast route
    .get('/v1/reactionsByCast', async ({ query }) => {
        return withSpan(
            'GET /v1/reactionsByCast',
            'http.server',
            async () => {
                logServiceMethod('api', 'getReactionsByCast', { query });
                addBreadcrumb('API request: GET /v1/reactionsByCast', 'api', 'info', { query });

                try {
                    const { target_fid, target_hash, reaction_type, pageSize, pageToken, reverse } = query;

                    if (!target_fid) {
                        return { error: 'target_fid parameter is required' };
                    }

                    if (!target_hash) {
                        return { error: 'target_hash parameter is required' };
                    }

                    if (!reaction_type) {
                        return { error: 'reaction_type parameter is required' };
                    }

                    const targetFidNumber = parseInt(target_fid as string);
                    const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 100;
                    const reverseFlag = reverse === 'true';

                    if (isNaN(targetFidNumber)) {
                        return { error: 'target_fid must be a valid number' };
                    }

                    if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
                        return { error: 'pageSize must be a valid positive number' };
                    }

                    // Call your service method
                    const result = await getReactionsByCast(
                        targetFidNumber,
                        target_hash as string,
                        reaction_type as 'Like' | 'Recast',
                        pageSizeNumber,
                        pageToken as string,
                        reverseFlag
                    );

                    // Ensure messages array is always defined to match schema
                    return {
                        messages: result.messages || [],
                        nextPageToken: result.nextPageToken
                    };
                } catch (error: any) {
                    logError(error, 'api_getReactionsByCast', {
                        target_fid: query.target_fid,
                        target_hash: query.target_hash,
                        reaction_type: query.reaction_type,
                        pageSize: query.pageSize,
                        pageToken: query.pageToken,
                        reverse: query.reverse,
                    });
                    return { error: 'Internal server error', details: error.message };
                }
            }
        );
    }, {
        query: reactionsByCastQuerySchema,
        response: reactionsByFidResponseSchema,
        detail: {
            tags: ['Reactions'],
            summary: 'Get all reactions to a Cast',
            description: `Get all reactions to a specific cast with pagination support.

**Parameters:**
- **target_fid** (required): The FID of the cast author
- **target_hash** (required): The hash of the target cast
- **reaction_type** (required): The type of reaction (Like or Recast)
- **pageSize** (optional): Page size, defaults to 100
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
            examples: reactionsByCastExamples
        }
    })
    .get('/v1/reactionsByTarget', async ({ query }) => {
        return withSpan(
            'GET /v1/reactionsByTarget',
            'http.server',
            async () => {
                logServiceMethod('api', 'getReactionsByTarget', { query });
                addBreadcrumb('API request: GET /v1/reactionsByTarget', 'api', 'info', { query });

                try {
                    const { url, reaction_type } = query;

                    if (!url) {
                        return { error: 'target url parameter is required' };
                    }

                    if (!reaction_type) {
                        return { error: 'reaction_type parameter is required' };
                    }

                    // Call your service method
                    const result = await getReactionsByTarget(
                        url,
                        reaction_type as 'Like' | 'Recast',
                    );

                    // Ensure messages array is always defined to match schema
                    return {
                        messages: result.messages || [],
                        nextPageToken: result.nextPageToken
                    };
                } catch (error: any) {
                    logError(error, 'api_getReactionsByTarget', {
                        url: query.url,
                        reaction_type: query.reaction_type,
                    });
                    return { error: 'Internal server error', details: error.message };
                }
            }
        );
    }, {
        query: reactionsByTargetQuerySchema,
        response: reactionsByFidResponseSchema,
        detail: {
            tags: ['Reactions'],
            summary: 'Get all reactions by Target',
            description: `Get all reactions to a cast's target URL with.

**Parameters:**
- **url** (required): The FID of the cast author
- **reaction_type** (required): The type of reaction (Like or Recast)

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
            examples: reactionsByTargetExamples
        }
    })