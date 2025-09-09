export interface HttpCastMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    castAddBody: {
      mentions?: number[];
      text: string;
      mentionsPositions?: number[];
      parentCastId?: {
        fid: number;
        hash: string;
      };
      parentUrl?: string;
      embeds?: Array<{
        url?: string;
        cast_id?: {
          fid: number;
          hash: string;
        };
      }>;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface HttpUserDataMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    userDataBody: {
      type: string;
      value: string;
    };
  };
  hash: string;
}

export interface HttpVerificationMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    verificationAddAddressBody: {
      address: string;
      claimSignature: string;
      blockHash: string;
      type: number;
      chainId: number;
      protocol: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface HttpLinkMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    linkBody: {
      type: string;
      targetFid?: number;
      displayTimestamp?: number | null;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface HttpReactionMessage {
  data: {
    type: string;
    fid: number;
    timestamp: number;
    network: string;
    reactionBody: {
      type: string;
      targetCastId?: {
        fid: number;
        hash: string;
      };
      targetUrl?: string;
    };
  };
  hash: string;
  hashScheme: string;
  signature: string;
  signatureScheme: string;
  signer: string;
}

export interface HttpStorageLimits {
  limits: Array<{
    storeType: string;
    name: string;
    limit: number;
    used: number;
    earliestTimestamp?: number;
    earliestHash?: string;
  }>;
  units: number;
  unit_details?: Array<{
    unitType: string;
    unitSize: number;
  }>;
  tier_subscriptions?: Array<{
    tier_type: string;
    expires_at: number;
  }>;
}

export interface HttpOnChainEvent {
  type: string;
  chainId: number;
  blockNumber: number;
  blockHash: string;
  blockTimestamp: number;
  transactionHash: string;
  logIndex: number;
  fid: number;
  signerEventBody?: {
    key: string;
    keyType: number;
    eventType: string;
    metadata?: string;
    metadataType?: number;
  };
  idRegisterEventBody?: {
    to: string;
    eventType: string;
    from: string;
    recoveryAddress: string;
  };
  tier_purchase_event_body?: any;
  txIndex: number;
  version: number;
}

export interface HttpResponse<T> {
  messages?: T[];
  events?: HttpOnChainEvent[];
  nextPageToken?: string;
}

// export type HttpSingleResponse<T> = T; // Unused

export interface HttpInfoResponse {
  version: string;
  isSyncing: boolean;
  nickname: string;
  rootHash: string;
  dbStats?: {
    numMessages: number;
    numFidEvents: number;
    numFnameEvents: number;
  };
  peerId: string;
  hubOperatorFid: number;
}

export interface HttpFidAddressTypeResponse {
  is_custody: boolean;
  is_auth: boolean;
  is_verified: boolean;
}