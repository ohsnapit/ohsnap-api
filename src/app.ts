import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { getCastByFidAndHash } from './services/cast.js';
import { API_PORT } from './utils/constants.js';

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: 'OhSnap API',
        version: '1.0.0',
        description: `Open source alternative to index the Farcaster snapchain. Compatible with Neynar API responses.
        
**Pagination Control**: Use fullCount=true parameter for complete accuracy or leave default for fast response with 10K limits.`,
        contact: {
          name: 'OhSnap API',
          url: 'https://github.com/ohsnapit/ohsnap-api'
        }
      },
      servers: [
        {
          url: `http://localhost:${API_PORT}`,
          description: 'Development server'
        }
      ],
      tags: [
        {
          name: 'Cast',
          description: 'Cast-related endpoints with optional pagination control. Use fullCount=true for complete accuracy.'
        },
        {
          name: 'Health',
          description: 'Health check endpoints'
        }
      ]
    },
    provider: 'swagger-ui'
  }))
  .get('/v1/cast', async ({ query }) => {
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

      // Get cast with all enrichments
      const response = await getCastByFidAndHash(fidNumber, hashString, useFullCount);
      return response;

    } catch (error: any) {
      console.error('Error fetching cast:', error);
      return { 
        error: 'Internal server error',
        details: error.message 
      };
    }
  }, {
    query: t.Object({
      fid: t.String({
        description: 'Farcaster ID (FID) of the cast author',
        example: '860783'
      }),
      hash: t.String({
        description: 'Cast hash in hex format (0x...)',
        example: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72'
      }),
      fullCount: t.Optional(t.String({
        description: 'Pagination mode for follower/reaction counts. Default: "false" (fast, up to 10K). Set to "true" for complete counts',
        example: 'true',
        enum: ['true', '1', 'false', '0']
      }))
    }),
    response: {
      200: t.Object({
        cast: t.Object({
          object: t.String(),
          hash: t.String(),
          author: t.Object({
            object: t.String(),
            fid: t.Number(),
            username: t.Optional(t.String()),
            display_name: t.Optional(t.String()),
            pfp_url: t.Optional(t.String()),
            custody_address: t.Optional(t.String()),
            profile: t.Optional(t.Object({
              bio: t.Optional(t.Object({
                text: t.String()
              }))
            })),
            follower_count: t.Optional(t.Number()),
            following_count: t.Optional(t.Number()),
            verifications: t.Optional(t.Array(t.String())),
            verified_addresses: t.Optional(t.Object({
              eth_addresses: t.Array(t.String()),
              sol_addresses: t.Array(t.String()),
              primary: t.Object({
                eth_address: t.String(),
                sol_address: t.String()
              })
            })),
            auth_addresses: t.Optional(t.Array(t.Object({
              address: t.String(),
              app: t.Optional(t.Object({
                object: t.String(),
                fid: t.Number()
              }))
            }))),
            verified_accounts: t.Optional(t.Array(t.Object({
              platform: t.String(),
              username: t.String()
            }))),
            power_badge: t.Optional(t.Boolean()),
            score: t.Optional(t.Number())
          }),
          app: t.Optional(t.Object({
            object: t.String(),
            fid: t.Number(),
            username: t.Optional(t.String()),
            display_name: t.Optional(t.String()),
            pfp_url: t.Optional(t.String()),
            custody_address: t.Optional(t.String())
          })),
          thread_hash: t.String(),
          parent_hash: t.Union([t.String(), t.Null()]),
          parent_url: t.Union([t.String(), t.Null()]),
          root_parent_url: t.Union([t.String(), t.Null()]),
          parent_author: t.Object({
            fid: t.Union([t.Number(), t.Null()])
          }),
          text: t.String(),
          timestamp: t.String(),
          embeds: t.Array(t.Object({
            url: t.Optional(t.String())
          })),
          reactions: t.Object({
            likes_count: t.Number(),
            recasts_count: t.Number(),
            likes: t.Array(t.Any()),
            recasts: t.Array(t.Any())
          }),
          replies: t.Object({
            count: t.Number()
          }),
          mentioned_profiles: t.Array(t.Any()),
          mentioned_profiles_ranges: t.Array(t.Any()),
          mentioned_channels: t.Array(t.Any()),
          mentioned_channels_ranges: t.Array(t.Any())
        })
      }),
      400: t.Object({
        error: t.String()
      }),
      500: t.Object({
        error: t.String(),
        details: t.Optional(t.String())
      })
    },
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
      examples: [
        {
          summary: 'Fast Mode (Default) - up to 10K counts',
          description: 'Returns with follower/reaction counts up to 10,000. Suitable for most use cases.',
          value: {
            fid: '3',
            hash: '0x029f7cceef2f0078f34949d6e339070fc6eb47b4'
          }
        },
        {
          summary: 'Full Mode - complete accurate counts',
          description: 'Returns complete counts for users with 10K+ followers/reactions. Use for analytics or when exact numbers are critical.',
          value: {
            fid: '3',
            hash: '0x029f7cceef2f0078f34949d6e339070fc6eb47b4',
            fullCount: 'true'
          }
        },
        {
          summary: 'Regular User - Fast mode sufficient',
          description: 'For most users with <10K followers, fast mode gives complete counts.',
          value: {
            fid: '860783',
            hash: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72'
          }
        }
      ]
    }
  })
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }), {
    response: {
      200: t.Object({
        status: t.String(),
        timestamp: t.String()
      })
    },
    detail: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Returns the current status and timestamp of the API server'
    }
  })
  .listen(API_PORT);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;