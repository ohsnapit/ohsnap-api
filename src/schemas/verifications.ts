import { t } from 'elysia';

// Verifications schemas
export const verificationsByFidQuerySchema = t.Object({
  fid: t.String({
    description: 'The FID of the verification\'s creator',
    example: '3'
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

export const verificationsByFidResponseSchema = {
  200: t.Object({
    messages: t.Array(t.Object({
      data: t.Object({
        type: t.String(),
        fid: t.Number(),
        timestamp: t.Number(),
        network: t.String(),
        verificationAddAddressBody: t.Object({
          address: t.String(),
          claimSignature: t.String(),
          blockHash: t.String(),
          type: t.Number(),
          chainId: t.Number(),
          protocol: t.String()
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

export const verificationsByFidExamples = [
  {
    summary: 'Get verifications by FID',
    description: 'Returns all address verifications by a specific FID.',
    value: { fid: '3' }
  },
  {
    summary: 'With pagination',
    description: 'Returns paginated results with custom page size.',
    value: { fid: '3', pageSize: '100', reverse: 'true' }
  }
];