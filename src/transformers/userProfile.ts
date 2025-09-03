import type { UserProfile, FollowCounts } from '../types/api.js';
import type { GrpcUserDataMessage, GrpcVerificationMessage, GrpcStorageLimits } from '../types/grpc.js';
import { USER_DATA_TYPES, DEFAULT_LOCATION } from '../utils/constants.js';
import { parseGeoLocation, parseLocationText, hexToBase58 } from '../utils/converters.js';

/**
 * Parse user data messages into profile data
 */
export function parseUserData(messages: GrpcUserDataMessage[]): Partial<UserProfile> {
  const profile: Partial<UserProfile> = {
    profile: {},
    verified_addresses: {
      eth_addresses: [],
      sol_addresses: [],
      primary: { eth_address: '', sol_address: '' }
    }
  };

  for (const message of messages) {
    const userData = message.data.userDataBody;
    if (!userData) continue;

    const { type, value } = userData;

    switch (type) {
      case USER_DATA_TYPES.USERNAME:
        profile.username = value;
        break;
      case USER_DATA_TYPES.DISPLAY:
        profile.display_name = value;
        break;
      case USER_DATA_TYPES.PFP:
        profile.pfp_url = value;
        break;
      case USER_DATA_TYPES.BIO:
        if (!profile.profile) profile.profile = {};
        profile.profile.bio = { text: value };
        break;
      case USER_DATA_TYPES.URL:
        profile.url = value;
        break;
      case USER_DATA_TYPES.LOCATION:
        const coords = parseGeoLocation(value);
        if (coords) {
          if (!profile.profile) profile.profile = {};
          profile.profile.location = {
            latitude: coords.latitude,
            longitude: coords.longitude,
            address: DEFAULT_LOCATION // For geo coordinates, we use default until we have geocoding
          };
        } else {
          // Try to parse as text location
          const address = parseLocationText(value);
          if (address) {
            if (!profile.profile) profile.profile = {};
            profile.profile.location = {
              latitude: 0,
              longitude: 0,
              address: address
            };
          }
        }
        break;
      case USER_DATA_TYPES.BANNER:
        if (!profile.profile) profile.profile = {};
        profile.profile.banner = { url: value };
        break;
      case USER_DATA_TYPES.TWITTER:
        if (!profile.verified_accounts) profile.verified_accounts = [];
        profile.verified_accounts.push({ platform: 'x', username: value });
        break;
      case USER_DATA_TYPES.GITHUB:
        if (!profile.verified_accounts) profile.verified_accounts = [];
        profile.verified_accounts.push({ platform: 'github', username: value });
        break;
      case USER_DATA_TYPES.PRIMARY_ADDRESS_ETHEREUM:
        if (profile.verified_addresses) {
          const normalizedValue = value.toLowerCase();
          profile.verified_addresses.primary.eth_address = normalizedValue;
          if (!profile.verified_addresses.eth_addresses.includes(normalizedValue)) {
            profile.verified_addresses.eth_addresses.push(normalizedValue);
          }
        }
        break;
      case USER_DATA_TYPES.PRIMARY_ADDRESS_SOLANA:
        if (profile.verified_addresses) {
          profile.verified_addresses.primary.sol_address = value;
          if (!profile.verified_addresses.sol_addresses.includes(value)) {
            profile.verified_addresses.sol_addresses.push(value);
          }
        }
        break;
    }
  }

  return profile;
}

/**
 * Parse verification messages into structured addresses
 */
export function parseVerifications(messages: GrpcVerificationMessage[]): {
  ethAddresses: string[];
  solAddresses: string[];
  allVerifications: string[];
} {
  const ethAddresses: string[] = [];
  const solAddresses: string[] = [];
  const allVerifications: string[] = [];
  
  for (const message of messages) {
    const verificationData = message.data.verificationAddAddressBody;
    if (verificationData && verificationData.address) {
      if (verificationData.protocol === 'PROTOCOL_SOLANA') {
        // Solana address - decode from base64 to base58
        try {
          const decodedBytes = Buffer.from(verificationData.address, 'base64');
          const solAddressHex = decodedBytes.toString('hex');
          const solAddressBase58 = hexToBase58(solAddressHex);
          solAddresses.push(solAddressBase58);
          allVerifications.push(solAddressBase58);
        } catch (error) {
          console.error('Failed to decode Solana address:', error);
        }
      } else {
        // ETH address (no protocol field means Ethereum) - convert bytes to hex
        try {
          const ethAddress = ('0x' + Buffer.from(verificationData.address, 'base64').toString('hex')).toLowerCase();
          ethAddresses.push(ethAddress);
          allVerifications.push(ethAddress);
        } catch (error) {
          console.error('Failed to decode Ethereum address:', error);
        }
      }
    }
  }
  
  return { ethAddresses, solAddresses, allVerifications };
}

/**
 * Check if user has Pro subscription
 */
export function checkProSubscription(storageLimits: GrpcStorageLimits | null): {
  hasPro: boolean;
  subscribedAt?: string;
  expiresAt?: string;
} {
  if (!storageLimits?.tierSubscriptions) {
    return { hasPro: false };
  }

  const proSubscription = storageLimits.tierSubscriptions.find(sub => 
    sub.tierType === 'Pro' && parseInt(sub.expiresAt) > Date.now() / 1000
  );

  if (proSubscription) {
    const expiresAt = new Date(parseInt(proSubscription.expiresAt) * 1000).toISOString();
    // Estimate subscription start as 1 year before expiry for annual subscriptions
    const subscribedAt = new Date(parseInt(proSubscription.expiresAt) * 1000 - (365 * 24 * 60 * 60 * 1000)).toISOString();
    
    return {
      hasPro: true,
      subscribedAt,
      expiresAt
    };
  }

  return { hasPro: false };
}

/**
 * Build complete user profile from all data sources
 */
export function buildUserProfile(
  fid: number,
  userDataMessages: GrpcUserDataMessage[],
  verificationMessages: GrpcVerificationMessage[],
  followCounts: FollowCounts,
  storageLimits: GrpcStorageLimits | null,
  custodyAddress?: string | null,
  authAddresses?: Array<{address: string, app?: any}>
): UserProfile {
  const parsedUserData = parseUserData(userDataMessages);
  const verificationData = parseVerifications(verificationMessages);
  const { hasPro, subscribedAt, expiresAt } = checkProSubscription(storageLimits);

  // Merge verification addresses with user data addresses
  const mergedVerifiedAddresses = {
    eth_addresses: [...new Set([
      ...(parsedUserData.verified_addresses?.eth_addresses || []),
      ...verificationData.ethAddresses
    ])],
    sol_addresses: [...new Set([
      ...(parsedUserData.verified_addresses?.sol_addresses || []),
      ...verificationData.solAddresses
    ])],
    primary: parsedUserData.verified_addresses?.primary || { eth_address: '', sol_address: '' }
  };

  // Set primary addresses if not already set
  if (!mergedVerifiedAddresses.primary.eth_address && mergedVerifiedAddresses.eth_addresses.length > 0) {
    mergedVerifiedAddresses.primary.eth_address = mergedVerifiedAddresses.eth_addresses[0] || '';
  }
  if (!mergedVerifiedAddresses.primary.sol_address && mergedVerifiedAddresses.sol_addresses.length > 0) {
    mergedVerifiedAddresses.primary.sol_address = mergedVerifiedAddresses.sol_addresses[0] || '';
  }

  // Determine power badge (simplified logic)
  const powerBadge = followCounts.followers > 10000 || hasPro;

  const profile: UserProfile = {
    object: 'user',
    fid: fid,
    username: parsedUserData.username,
    display_name: parsedUserData.display_name,
    pfp_url: parsedUserData.pfp_url,
    custody_address: custodyAddress || undefined,
    ...(hasPro && subscribedAt && expiresAt && {
      pro: {
        status: 'subscribed',
        subscribed_at: subscribedAt, 
        expires_at: expiresAt
      }
    }),
    profile: parsedUserData.profile,
    follower_count: followCounts.followers,
    following_count: followCounts.following,
    verifications: verificationData.allVerifications,
    verified_addresses: mergedVerifiedAddresses,
    auth_addresses: authAddresses || [],
    verified_accounts: parsedUserData.verified_accounts,
    power_badge: powerBadge,
    url: parsedUserData.url,
    score: Math.min(0.99, Math.max(0.1, followCounts.followers / 100000))
  };

  return profile;
}