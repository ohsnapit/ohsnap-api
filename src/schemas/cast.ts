import { t } from 'elysia';

export const castQuerySchema = t.Object({
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
});

export const castResponseSchema = {
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
          bio: t.Optional(t.Object({ text: t.String() })),
          banner: t.Optional(t.Object({ url: t.String() })),
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
      parent_author: t.Object({ fid: t.Union([t.Number(), t.Null()]) }),
      text: t.String(),
      timestamp: t.String(),
      embeds: t.Array(t.Object({ url: t.Optional(t.String()) })),
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
      replies: t.Object({ count: t.Number() }),
      mentioned_profiles: t.Array(t.Any()),
      mentioned_profiles_ranges: t.Array(t.Any()),
      mentioned_channels: t.Array(t.Any()),
      mentioned_channels_ranges: t.Array(t.Any()),
      author_channel_context: t.Optional(t.Object({
        following: t.Boolean()
      }))
    })
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const castExamples = [
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
];


export const castFullResponseSchema = {
  type: "object",
  properties: {
    cast: {
      type: "object",
      properties: {
        hash: { type: "string" },
        text: { type: "string" },
        timestamp: { type: "string" },
        authorFid: { type: "number" }
      },
      required: ["hash", "text", "timestamp", "authorFid"]
    },
    user: {
      type: "object",
      properties: {
        fid: { type: "number" },
        username: { type: "string" },
        displayName: { type: "string" },
        pfpUrl: { type: "string" },
        followerCount: { type: "number" },
        followingCount: { type: "number" }
      },
      required: ["fid", "username", "displayName", "pfpUrl"]
    },
    likes: {
      type: "object",
      properties: {
        total: { type: "number" },
        fids: { type: "array", items: { type: "number" } }
      }
    },
    recasts: {
      type: "object",
      properties: {
        total: { type: "number" },
        fids: { type: "array", items: { type: "number" } }
      }
    },
    replies: {
      type: "object",
      properties: {
        total: { type: "number" },
        hashes: { type: "array", items: { type: "string" } }
      }
    },
    followers: {
      type: "object",
      properties: {
        total: { type: "number" },
        fids: { type: "array", items: { type: "number" } }
      }
    },
    following: {
      type: "object",
      properties: {
        total: { type: "number" },
        fids: { type: "array", items: { type: "number" } }
      }
    }
  }
};