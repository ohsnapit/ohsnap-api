import { Elysia, t } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { getCastByFidAndHash, getEnrichedUserProfile, getCastsByFid } from './services/cast.js';
import { API_PORT } from './utils/constants.js';
import { openApiConfig } from './config/openapi.js';

const app = new Elysia()
  .use(openapi(openApiConfig))
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
        example: 'false',
        enum: ['true', 'false']
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
              })),
              banner: t.Optional(t.Object({
                url: t.String()
              })),
              location: t.Optional(t.Object({
                latitude: t.Number(),
                longitude: t.Number(),
                address: t.Object({
                  city: t.String(),
                  state: t.String(),
                  state_code: t.String(),
                  country: t.String(),
                  country_code: t.String()
                })
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
            score: t.Optional(t.Number()),
            url: t.Optional(t.String()),
            pro: t.Optional(t.Object({
              status: t.String(),
              subscribed_at: t.String(),
              expires_at: t.String()
            }))
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
          channel: t.Union([
            t.Object({
              object: t.String(),
              id: t.String(),
              name: t.String(),
              image_url: t.String()
            }),
            t.Null()
          ]),
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
          mentioned_channels_ranges: t.Array(t.Any()),
          author_channel_context: t.Optional(t.Object({
            following: t.Boolean()
          }))
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
  .get('/v1/user', async ({ query }) => {
    try {
      const { fid, fullCount } = query;
      
      if (!fid) {
        return { error: 'fid parameter is required' };
      }

      // Parse comma-separated FIDs for bulk support
      const fidStrings = (fid as string).split(',').map(f => f.trim());
      const useFullCount = fullCount === 'true' || fullCount === '1';
      
      // Validate all FIDs
      const fidNumbers: number[] = [];
      for (const fidStr of fidStrings) {
        const fidNumber = parseInt(fidStr);
        if (isNaN(fidNumber)) {
          return { error: `Invalid fid: ${fidStr}. All FIDs must be valid numbers.` };
        }
        fidNumbers.push(fidNumber);
      }

      // Fetch user profiles
      const users = await Promise.all(
        fidNumbers.map(fidNumber => getEnrichedUserProfile(fidNumber, useFullCount))
      );

      // Return in Neynar API format
      return {
        users,
        next: {
          cursor: null
        }
      };

    } catch (error: any) {
      console.error('Error fetching users:', error);
      return { 
        error: 'Internal server error',
        details: error.message 
      };
    }
  }, {
    query: t.Object({
      fid: t.String({
        description: 'Comma-separated Farcaster IDs (FID) to fetch. Can be single FID or multiple (e.g., "3" or "3,2,9")',
        example: '3'
      }),
      fullCount: t.Optional(t.String({
        description: 'Pagination mode for follower counts. Default: "false" (fast, up to 10K). Set to "true" for complete counts',
        example: 'false',
        enum: ['true', 'false']
      }))
    }),
    response: {
      200: t.Object({
        users: t.Array(t.Object({
          object: t.String(),
          fid: t.Number(),
          username: t.Optional(t.String()),
          display_name: t.Optional(t.String()),
          pfp_url: t.Optional(t.String()),
          custody_address: t.Optional(t.String()),
          pro: t.Optional(t.Object({
            status: t.String(),
            subscribed_at: t.String(),
            expires_at: t.String()
          })),
          profile: t.Optional(t.Object({
            bio: t.Optional(t.Object({
              text: t.String()
            })),
            banner: t.Optional(t.Object({
              url: t.String()
            })),
            location: t.Optional(t.Object({
              latitude: t.Number(),
              longitude: t.Number(),
              address: t.Object({
                city: t.String(),
                state: t.String(),
                state_code: t.String(),
                country: t.String(),
                country_code: t.String()
              })
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
          url: t.Optional(t.String()),
          experimental: t.Optional(t.Object({
            neynar_user_score: t.Number(),
            deprecation_notice: t.String()
          })),
          score: t.Optional(t.Number())
        })),
        next: t.Object({
          cursor: t.Union([t.String(), t.Null()])
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
      examples: [
        {
          summary: 'Single user - Fast Mode (Default)',
          description: 'Returns single user with follower/following counts up to 10,000.',
          value: {
            fid: '3'
          }
        },
        {
          summary: 'Multiple users - Bulk fetch',
          description: 'Returns multiple users in a single request.',
          value: {
            fid: '3,2,9'
          }
        },
        {
          summary: 'Full Mode - complete accurate counts',
          description: 'Returns complete counts for users with 10K+ followers/following. Use for analytics.',
          value: {
            fid: '3',
            fullCount: 'true'
          }
        }
      ]
    }
  })
  .get('/v1/user/casts', async ({ query }) => {
    try {
      const { fid, cursor, limit, fullCount, include_replies } = query;
      
      if (!fid) {
        return { error: 'fid parameter is required' };
      }

      const fidNumber = parseInt(fid as string);
      const useFullCount = fullCount === 'true' || fullCount === '1';
      const pageSize = limit ? parseInt(limit as string) : 25;
      const includeReplies = include_replies !== 'false'; // Default to true, only false when explicitly set to "false"

      if (isNaN(fidNumber)) {
        return { error: 'fid must be a valid number' };
      }

      if (pageSize < 1 || pageSize > 150) {
        return { error: 'limit must be between 1 and 150' };
      }

      // Get casts in reverse chronological order (newest first)
      const response = await getCastsByFid(
        fidNumber,
        cursor as string,
        pageSize,
        useFullCount,
        includeReplies
      );

      return response;

    } catch (error: any) {
      console.error('Error fetching user casts:', error);
      return { 
        error: 'Internal server error',
        details: error.message 
      };
    }
  }, {
    query: t.Object({
      fid: t.String({
        description: 'Farcaster ID (FID) of the user whose casts to fetch',
        example: '3'
      }),
      cursor: t.Optional(t.String({
        description: 'Pagination cursor for next page',
        example: 'eyJ0aW1lc3RhbXAiOiIyMDI1LTA5LTA0VDEyOjAwOjAwLjAwMFoifQ%3D%3D'
      })),
      limit: t.Optional(t.String({
        description: 'Number of casts to return (1-150, default: 25)',
        example: '25'
      })),
      fullCount: t.Optional(t.String({
        description: 'Pagination mode for follower/reaction counts. Default: "false" (fast, up to 10K). Set to "true" for complete counts',
        example: 'false',
        enum: ['true', 'false']
      })),
      include_replies: t.Optional(t.String({
        description: 'Include reply casts in results. Default: "true". Set to "false" to exclude replies',
        example: 'true',
        enum: ['true', 'false']
      }))
    }),
    response: {
      200: t.Object({
        casts: t.Array(t.Object({
          object: t.String(),
          hash: t.String(),
          author: t.Object({
            object: t.String(),
            fid: t.Number(),
            username: t.Optional(t.String()),
            display_name: t.Optional(t.String()),
            pfp_url: t.Optional(t.String()),
            custody_address: t.Optional(t.String()),
            pro: t.Optional(t.Object({
              status: t.String(),
              subscribed_at: t.String(),
              expires_at: t.String()
            })),
            profile: t.Optional(t.Object({
              bio: t.Optional(t.Object({
                text: t.String()
              })),
              banner: t.Optional(t.Object({
                url: t.String()
              })),
              location: t.Optional(t.Object({
                latitude: t.Number(),
                longitude: t.Number(),
                address: t.Object({
                  city: t.String(),
                  state: t.String(),
                  state_code: t.String(),
                  country: t.String(),
                  country_code: t.String()
                })
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
            score: t.Optional(t.Number()),
            url: t.Optional(t.String())
          }),
          thread_hash: t.String(),
          parent_hash: t.Union([t.String(), t.Null()]),
          parent_url: t.Union([t.String(), t.Null()]),
          root_parent_url: t.Union([t.String(), t.Null()]),
          parent_author: t.Object({
            fid: t.Union([t.Number(), t.Null()])
          }),
          text: t.String(),
          timestamp: t.String(),
          embeds: t.Array(t.Any()),
          channel: t.Union([t.Object({
            object: t.String(),
            id: t.String(),
            name: t.String(),
            image_url: t.String()
          }), t.Null()]),
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
        })),
        next: t.Object({
          cursor: t.Union([t.String(), t.Null()])
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
      examples: [
        {
          summary: 'Get latest casts from user',
          description: 'Returns the latest 25 casts from the specified user in reverse chronological order.',
          value: {
            fid: '3'
          }
        },
        {
          summary: 'Get casts with pagination',
          description: 'Returns casts with custom limit and pagination cursor.',
          value: {
            fid: '3',
            limit: '50',
            cursor: 'eyJ0aW1lc3RhbXAiOiIyMDI1LTA5LTA0VDEyOjAwOjAwLjAwMFoifQ%3D%3D'
          }
        },
        {
          summary: 'Full count mode',
          description: 'Returns casts with complete reaction/reply counts.',
          value: {
            fid: '3',
            fullCount: 'true'
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
  });

// For local development - only listen when not in serverless environment
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
  app.listen(API_PORT);
  console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);
}

export default app;