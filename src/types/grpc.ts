export interface GrpcCastMessage {
  data: {
    type: string;
    fid: string;
    timestamp: number;
    network: string;
    castAddBody: {
      mentions?: string[];
      text: string;
      mentionsPositions?: number[];
      parentCastId?: {
        fid: string;
        hash: string;
      };
      parentUrl?: string;
      embeds?: Array<{
        url?: string;
        cast_id?: {
          fid: string;
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

export interface GrpcUserDataMessage {
  data: {
    type: string;
    fid: string;
    timestamp: number;
    network: string;
    userDataBody: {
      type: string;
      value: string;
    };
  };
  hash: string;
}

export interface GrpcVerificationMessage {
  data: {
    type: string;
    fid: string;
    timestamp: number;
    network: string;
    verificationAddAddressBody: {
      address: string;
      protocol: string;
    };
  };
  hash: string;
}

export interface GrpcLinkMessage {
  data: {
    type: string;
    fid: string;
    timestamp: number;
    network: string;
    linkBody: {
      type: string;
      targetFid: string;
      displayTimestamp?: number;
    };
  };
  hash: string;
}

export interface GrpcStorageLimits {
  limits: Array<{
    storeType: string;
    name: string;
    limit: string;
    used: string;
  }>;
  units: number;
  tierSubscriptions?: Array<{
    tierType: string;
    expiresAt: string;
  }>;
}