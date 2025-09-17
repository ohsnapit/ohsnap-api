import { t } from 'elysia';

// Reactions schemas
export const reactionsByFidQuerySchema = t.Object({
  fid: t.String({
    description: 'The FID of the reaction\'s creator',
    example: '3'
  }),
  reaction_type: t.String({
    description: 'The type of reaction, use string representation',
    example: 'Like',
    enum: ['Like', 'Recast']
  }),
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

export const reactionsByFidResponseSchema = {
  200: t.Object({
    messages: t.Array(t.Object({
      data: t.Object({
        type: t.String(),
        fid: t.Number(),
        timestamp: t.Number(),
        network: t.String(),
        reactionBody: t.Object({
          type: t.String(),
          targetCastId: t.Optional(t.Object({
            fid: t.Number(),
            hash: t.String()
          })),
          targetUrl: t.Optional(t.String())
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

// Reactions by Cast schemas
export const reactionsByCastQuerySchema = t.Object({
  target_fid: t.String({
    description: 'The FID of the cast author',
    example: '860783'
  }),
  target_hash: t.String({
    description: 'The hash of the target cast',
    example: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72'
  }),
  reaction_type: t.String({
    description: 'The type of reaction, use string representation',
    example: 'Like',
    enum: ['Like', 'Recast']
  }),
  pageSize: t.Optional(t.String({
    description: 'Optional page size (default: 100)',
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

export const reactionsByFidExamples = [
  {
    summary: 'Get likes by FID',
    description: 'Returns all likes by a specific FID.',
    value: { fid: '3', reaction_type: 'Like' }
  },
  {
    summary: 'Get recasts by FID',
    description: 'Returns all recasts by a specific FID.',
    value: { fid: '3', reaction_type: 'Recast' }
  },
  {
    summary: 'With pagination',
    description: 'Returns paginated results with custom page size.',
    value: { fid: '3', reaction_type: 'Like', pageSize: '100', reverse: 'true' }
  }
];

export const reactionsByCastExamples = [
  {
    summary: 'Get likes for a cast',
    description: 'Returns all likes for a specific cast.',
    value: { target_fid: '860783', target_hash: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72', reaction_type: 'Like' }
  },
  {
    summary: 'Get recasts for a cast',
    description: 'Returns all recasts for a specific cast.',
    value: { target_fid: '860783', target_hash: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72', reaction_type: 'Recast' }
  },
  {
    summary: 'With pagination',
    description: 'Returns paginated results with custom page size.',
    value: { target_fid: '860783', target_hash: '0xcefff5d03bf661f4f9d709386816bd4d6ba49c72', reaction_type: 'Like', pageSize: '100', reverse: 'true' }
  }
];