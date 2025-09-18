import Elysia from "elysia";
import { withSpan, addBreadcrumb } from "../utils/tracing";
import { logServiceMethod, logError } from "../utils/logger";
import { linksByFidQuerySchema, linksByFidResponseSchema, linksByFidExamples, linksByTargetFidQuerySchema, linksByTargetFidResponseSchema, linksByTargetFidExamples } from "../schemas/links";
import { getLinksByFid, getLinksByTargetFid } from "../services/http";



export const linkRoutes = new Elysia()
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