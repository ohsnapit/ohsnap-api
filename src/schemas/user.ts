import { t } from 'elysia';

export const userQuerySchema = t.Object({
  fid: t.String({
    description: 'Comma-separated Farcaster IDs (FID) to fetch. Can be single FID or multiple (e.g., "3" or "3,2,9")',
    example: '3'
  }),
  fullCount: t.Optional(t.String({
    description: 'Pagination mode for follower counts. Default: "false" (fast, up to 10K). Set to "true" for complete counts',
    example: 'false',
    enum: ['true', 'false']
  }))
});

export const usernameQuerySchema = t.Object({
  username: t.String(),
  fullCount: t.Optional(t.String())
})

export const userResponseSchema = {
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
      url: t.Optional(t.String()),
      experimental: t.Optional(t.Object({
        neynar_user_score: t.Number(),
        deprecation_notice: t.String()
      })),
      score: t.Optional(t.Number())
    })),
    next: t.Object({ cursor: t.Union([t.String(), t.Null()]) })
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const userExamples = [
  {
    summary: 'Single user - Fast Mode (Default)',
    description: 'Returns single user with follower/following counts up to 10,000.',
    value: { fid: '3' }
  },
  {
    summary: 'Multiple users - Bulk fetch',
    description: 'Returns multiple users in a single request.',
    value: { fid: '3,2,9' }
  },
  {
    summary: 'Full Mode - complete accurate counts',
    description: 'Returns complete counts for users with 10K+ followers/following. Use for analytics.',
    value: { fid: '3', fullCount: 'true' }
  }
];

export const userCastsQuerySchema = t.Object({
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
});

export const userCastsResponseSchema = {
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
        url: t.Optional(t.String()),
        experimental: t.Optional(t.Object({
          neynar_user_score: t.Number(),
          deprecation_notice: t.String()
        })),
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
    })),
    next: t.Object({ cursor: t.Union([t.String(), t.Null()]) })
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const userCastsExamples = [
  {
    summary: 'Basic - Latest casts (Fast Mode)',
    description: 'Returns most recent casts from a user in reverse chronological order, with counts up to 10K.',
    value: { fid: '3', limit: '25' }
  },
  {
    summary: 'With pagination',
    description: 'Returns next page of results using cursor from previous response.',
    value: { fid: '3', cursor: 'eyJ0aW1lc3RhbXAiOiIyMDI1LTA5LTA0VDA...' }
  },
  {
    summary: 'Exclude replies',
    description: 'Returns only original casts from a user, excluding replies.',
    value: { fid: '3', include_replies: 'false' }
  },
  {
    summary: 'Full Mode - accurate counts',
    description: 'Returns casts with complete accurate counts for users with 10K+ followers/reactions.',
    value: { fid: '3', fullCount: 'true' }
  }
];
