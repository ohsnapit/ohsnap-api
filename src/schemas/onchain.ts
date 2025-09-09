import { t } from 'elysia';

export const onchainSignersQuerySchema = t.Object({
  fid: t.String({
    description: 'The Farcaster ID being requested',
    example: '3'
  }),
  signer: t.Optional(t.String({
    description: 'The optional key of signer',
    example: '0x0852c07b5695ff94138b025e3f9b4788e06133f04e254f0ea0eb85a06e999cdd'
  }))
});

export const onchainSignersResponseSchema = {
  200: t.Object({
    events: t.Array(t.Object({
      type: t.String(),
      chainId: t.Number(),
      blockNumber: t.Number(),
      blockHash: t.String(),
      blockTimestamp: t.Number(),
      transactionHash: t.String(),
      logIndex: t.Number(),
      fid: t.Number(),
      signerEventBody: t.Optional(t.Object({
        key: t.String(),
        keyType: t.Number(),
        eventType: t.String(),
        metadata: t.Optional(t.String()),
        metadataType: t.Optional(t.Number())
      })),
      tier_purchase_event_body: t.Optional(t.Any()),
      txIndex: t.Number(),
      version: t.Number()
    }))
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const onchainSignersExamples = [
  {
    summary: 'Basic request',
    description: 'Returns on-chain signer events for a specific FID.',
    value: { fid: '3' }
  },
  {
    summary: 'With specific signer',
    description: 'Returns events for a specific signer key.',
    value: { fid: '3', signer: '0x0852c07b5695ff94138b025e3f9b4788e06133f04e254f0ea0eb85a06e999cdd' }
  }
];

export const onchainEventsQuerySchema = t.Object({
  fid: t.String({
    description: 'The FID being requested',
    example: '3'
  }),
  event_type: t.String({
    description: 'The string value of the event type being requested. This parameter is required',
    example: 'EVENT_TYPE_SIGNER',
    enum: [
      'EVENT_TYPE_NONE',
      'EVENT_TYPE_SIGNER',
      'EVENT_TYPE_SIGNER_MIGRATED',
      'EVENT_TYPE_ID_REGISTER',
      'EVENT_TYPE_STORAGE_RENT',
      'EVENT_TYPE_TIER_PURCHASE'
    ]
  })
});

export const onchainEventsResponseSchema = {
  200: t.Object({
    events: t.Array(t.Object({
      type: t.String(),
      chainId: t.Number(),
      blockNumber: t.Number(),
      blockHash: t.String(),
      blockTimestamp: t.Number(),
      transactionHash: t.String(),
      logIndex: t.Number(),
      fid: t.Number(),
      signerEventBody: t.Optional(t.Object({
        key: t.String(),
        keyType: t.Number(),
        eventType: t.String(),
        metadata: t.Optional(t.String()),
        metadataType: t.Optional(t.Number())
      })),
      idRegisterEventBody: t.Optional(t.Object({
        to: t.String(),
        eventType: t.String(),
        from: t.String(),
        recoveryAddress: t.String()
      })),
      tier_purchase_event_body: t.Optional(t.Any()),
      txIndex: t.Number(),
      version: t.Number()
    }))
  }),
  400: t.Object({ error: t.String() }),
  500: t.Object({ error: t.String(), details: t.Optional(t.String()) })
};

export const onchainEventsExamples = [
  {
    summary: 'Get signer events',
    description: 'Returns on-chain signer events for a specific FID.',
    value: { fid: '3', event_type: 'EVENT_TYPE_SIGNER' }
  },
  {
    summary: 'Get ID register events',
    description: 'Returns ID register events for a specific FID.',
    value: { fid: '3', event_type: 'EVENT_TYPE_ID_REGISTER' }
  },
  {
    summary: 'Get storage rent events',
    description: 'Returns storage rent events for a specific FID.',
    value: { fid: '3', event_type: 'EVENT_TYPE_STORAGE_RENT' }
  }
];