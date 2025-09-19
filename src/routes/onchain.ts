import Elysia from "elysia";
import { withSpan, addBreadcrumb } from "../utils/tracing.js";
import { logServiceMethod, logError } from "../utils/logger.js";
import { getOnChainSignersByFidSimple, getOnChainEventsByFidSimple } from "../services/http.js";
import { onchainSignersQuerySchema, onchainSignersResponseSchema, onchainSignersExamples, onchainEventsQuerySchema, onchainEventsResponseSchema, onchainEventsExamples } from "../schemas/onchain.js";

export const onChainRoutes = new Elysia()
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