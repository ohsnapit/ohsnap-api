import type { UserProfile, FollowCounts } from '../types/api.js';
import type { GrpcUserDataMessage, GrpcVerificationMessage, GrpcStorageLimits } from '../types/grpc.js';
import { USER_DATA_TYPES, DEFAULT_LOCATION } from '../utils/constants.js';
import { parseGeoLocation } from '../utils/converters.js';

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
            ...coords,
            address: DEFAULT_LOCATION
          };
        }
        break;
      case USER_DATA_TYPES.PRIMARY_ADDRESS_ETHEREUM:
        if (profile.verified_addresses) {
          profile.verified_addresses.primary.eth_address = value;
          if (!profile.verified_addresses.eth_addresses.includes(value)) {
            profile.verified_addresses.eth_addresses.push(value);
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
 * Parse verification messages into address list
 */
export function parseVerifications(messages: GrpcVerificationMessage[]): string[] {
  const verifications: string[] = [];
  
  for (const message of messages) {
    const verificationData = message.data.verificationAddAddressBody;
    if (verificationData && verificationData.address) {
      // Convert bytes to hex address
      const address = '0x' + Buffer.from(verificationData.address, 'base64').toString('hex');
      verifications.push(address);
    }
  }
  
  return verifications;
}

/**
 * Check if user has Pro subscription
 */
export function checkProSubscription(storageLimits: GrpcStorageLimits | null): {
  hasPro: boolean;
  expiresAt?: string;
} {
  if (!storageLimits?.tierSubscriptions) {
    return { hasPro: false };
  }

  const proSubscription = storageLimits.tierSubscriptions.find(sub => 
    sub.tierType === 'Pro' && parseInt(sub.expiresAt) > Date.now() / 1000
  );

  return {
    hasPro: !!proSubscription,
    expiresAt: proSubscription ? new Date(parseInt(proSubscription.expiresAt) * 1000).toISOString() : undefined
  };
}

/**
 * Build complete user profile from all data sources
 */
export function buildUserProfile(
  fid: number,
  userDataMessages: GrpcUserDataMessage[],
  verificationMessages: GrpcVerificationMessage[],
  followCounts: FollowCounts,
  storageLimits: GrpcStorageLimits | null
): UserProfile {
  const parsedUserData = parseUserData(userDataMessages);
  const verifications = parseVerifications(verificationMessages);
  const { hasPro, expiresAt } = checkProSubscription(storageLimits);

  // Determine power badge (simplified logic)
  const powerBadge = followCounts.followers > 10000 || hasPro;

  const profile: UserProfile = {
    object: 'user',
    fid: fid,
    username: parsedUserData.username,
    display_name: parsedUserData.display_name,
    pfp_url: parsedUserData.pfp_url,
    profile: parsedUserData.profile,
    verifications: verifications,
    verified_addresses: parsedUserData.verified_addresses,
    url: parsedUserData.url,
    follower_count: followCounts.followers,
    following_count: followCounts.following,
    power_badge: powerBadge,
    score: Math.min(0.99, Math.max(0.1, followCounts.followers / 100000)),
    ...(hasPro && expiresAt && {
      pro: {
        status: 'subscribed',
        subscribed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Approximate
        expires_at: expiresAt
      }
    })
  };

  return profile;
}