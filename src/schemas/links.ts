import { t } from 'elysia';

// Links schemas
export const linksByFidQuerySchema = t.Object({
  fid: t.String({
    description: 'The FID of the link\'s creator',
    example: '3'
  }),
  link_type: t.Optional(t.String({
    description: 'The type of link (e.g., "follow")',
    example: 'follow'
  })),
  pageSize: t.Optional(t.String({
    description: 'Optional page size (default: 1000)',
    example: '100'
  })),
  pageToken: t.Optional(t.String({
    description: 'Optional page token for pagination',
    example: 'DAEDAAAGlQ...'
  })),
  reverse: t.Optional(t.String({
    description: 'Optional reverse order flag',
    example: 'true',
    enum: ['true', 'false']
  }))
});

export const linksByFidResponseSchema = {
  200: t.Object({
    messages: t.Array(t.Object({
      data: t.Object({
        type: t.String(),
        fid: t.Number(),
        timestamp: t.Number(),
        network: t.String(),
        linkBody: t.Object({
          type: t.String(),
          displayTimestamp: t.Optional(t.Union([t.Number(), t.Null()])),
          targetFid: t.Optional(t.Number())
        })
      }),
      hash: t.String(),
      hashScheme: t.String(),
      signature: t.String(),
      signatureScheme: t.String(),
      signer: t.String()
    })),
    nextPageToken: t.Optional(t.String())
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const linksByFidExamples = [
  {
    summary: 'Get all links by FID',
    description: 'Returns all links by a specific FID.',
    value: { fid: '3' }
  },
  {
    summary: 'Get follow links by FID',
    description: 'Returns all follow links by a specific FID.',
    value: { fid: '3', link_type: 'follow' }
  },
  {
    summary: 'With pagination',
    description: 'Returns paginated results with custom page size.',
    value: { fid: '3', link_type: 'follow', pageSize: '100', reverse: 'true' }
  }
];

// Links by target FID schemas (followers)
export const linksByTargetFidQuerySchema = t.Object({
  target_fid: t.String({
    description: 'The FID of the target user (who is being followed)',
    example: '3'
  }),
  link_type: t.Optional(t.String({
    description: 'The type of link (e.g., "follow")',
    example: 'follow'
  })),
  pageSize: t.Optional(t.String({
    description: 'Optional page size (default: 1000)',
    example: '100'
  })),
  pageToken: t.Optional(t.String({
    description: 'Optional page token for pagination',
    example: 'DAEDAAAGlQ...'
  })),
  reverse: t.Optional(t.String({
    description: 'Optional reverse order flag',
    example: 'true',
    enum: ['true', 'false']
  }))
});

export const linksByTargetFidResponseSchema = {
  200: t.Object({
    messages: t.Array(t.Object({
      data: t.Object({
        type: t.String(),
        fid: t.Number(),
        timestamp: t.Number(),
        network: t.String(),
        linkBody: t.Object({
          type: t.String(),
          displayTimestamp: t.Optional(t.Union([t.Number(), t.Null()])),
          targetFid: t.Optional(t.Number())
        })
      }),
      hash: t.String(),
      hashScheme: t.String(),
      signature: t.String(),
      signatureScheme: t.String(),
      signer: t.String()
    })),
    nextPageToken: t.Optional(t.String())
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const linksByTargetFidExamples = [
  {
    summary: 'Get all followers of FID',
    description: 'Returns all users following a specific FID.',
    value: { target_fid: '3' }
  },
  {
    summary: 'Get follow links to FID',
    description: 'Returns all follow links targeting a specific FID.',
    value: { target_fid: '3', link_type: 'follow' }
  },
  {
    summary: 'With pagination',
    description: 'Returns paginated results with custom page size.',
    value: { target_fid: '3', link_type: 'follow', pageSize: '100', reverse: 'true' }
  }
];