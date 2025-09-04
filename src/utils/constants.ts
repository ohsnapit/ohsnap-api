export const GRPC_CONTAINER = process.env.GRPC_CONTAINER || 'snapchain-ohsnap-snapchain-1';
export const GRPC_HOST = process.env.GRPC_HOST || 'localhost:3383';
export const HTTP_HOST = process.env.HTTP_HOST || 'http://localhost:3381';

export const USER_DATA_TYPES = {
  USERNAME: 'USER_DATA_TYPE_USERNAME',
  DISPLAY: 'USER_DATA_TYPE_DISPLAY',
  PFP: 'USER_DATA_TYPE_PFP',
  BIO: 'USER_DATA_TYPE_BIO',
  URL: 'USER_DATA_TYPE_URL',
  LOCATION: 'USER_DATA_TYPE_LOCATION',
  TWITTER: 'USER_DATA_TYPE_TWITTER',
  GITHUB: 'USER_DATA_TYPE_GITHUB',
  BANNER: 'USER_DATA_TYPE_BANNER',
  PRIMARY_ADDRESS_ETHEREUM: 'USER_DATA_PRIMARY_ADDRESS_ETHEREUM',
  PRIMARY_ADDRESS_SOLANA: 'USER_DATA_PRIMARY_ADDRESS_SOLANA',
} as const;

export const MESSAGE_TYPES = {
  CAST_ADD: 'MESSAGE_TYPE_CAST_ADD',
  LINK_ADD: 'MESSAGE_TYPE_LINK_ADD',
  REACTION_ADD: 'MESSAGE_TYPE_REACTION_ADD',
  VERIFICATION_ADD_ETH_ADDRESS: 'MESSAGE_TYPE_VERIFICATION_ADD_ETH_ADDRESS',
} as const;

export const REACTION_TYPES = {
  LIKE: 'REACTION_TYPE_LIKE',
  RECAST: 'REACTION_TYPE_RECAST',
} as const;

export const LINK_TYPES = {
  FOLLOW: 'follow',
} as const;

export const DEFAULT_LOCATION = {
  city: 'Unknown',
  state: 'Unknown',
  state_code: 'unknown',
  country: 'Unknown',
  country_code: 'unknown',
};

export const EXEC_TIMEOUT = parseInt(process.env.EXEC_TIMEOUT || '25000');
export const EXEC_MAX_BUFFER = parseInt(process.env.EXEC_MAX_BUFFER || '104857600'); // 100MB

export const API_PORT = parseInt(process.env.API_PORT || '3001');

// HTTP API Configuration
export const HTTP_BASE_URL = `${HTTP_HOST}/v1`;
export const HTTP_IP = process.env.HTTP_IP || 'localhost';

export const LOCATION_IQ_API_KEY = process.env.LOCATION_IQ_API_KEY || '';