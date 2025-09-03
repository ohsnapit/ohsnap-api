import type { UserProfile, FollowCounts } from '../types/api.js';
import type { HttpUserDataMessage, HttpVerificationMessage, HttpStorageLimits } from '../types/http.js';
import { USER_DATA_TYPES, DEFAULT_LOCATION } from '../utils/constants.js';
import { parseGeoLocation, parseLocationText } from '../utils/converters.js';

/**
 * Parse user data messages into profile data
 */
export function parseUserData(messages: HttpUserDataMessage[]): Partial<UserProfile> {
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
export function parseVerifications(messages: HttpVerificationMessage[]): {
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
        // Solana address - already in correct format
        try {
          const solAddress = verificationData.address;
          solAddresses.push(solAddress);
          allVerifications.push(solAddress);
        } catch (error) {
          console.error('Failed to process Solana address:', error);
        }
      } else {
        // ETH address - HTTP format is already hex
        try {
          const ethAddress = verificationData.address.toLowerCase();
          ethAddresses.push(ethAddress);
          allVerifications.push(ethAddress);
        } catch (error) {
          console.error('Failed to process Ethereum address:', error);
        }
      }
    }
  }
  
  return { ethAddresses, solAddresses, allVerifications };
}

/**
 * Check if user has Pro subscription
 */
export function checkProSubscription(storageLimits: HttpStorageLimits | null): {
  hasPro: boolean;
  subscribedAt?: string;
  expiresAt?: string;
} {
  if (!storageLimits?.tier_subscriptions) {
    return { hasPro: false };
  }

  const proSubscription = storageLimits.tier_subscriptions.find(sub => 
    sub.tier_type === 'Pro' && parseInt(String(sub.expires_at)) > Date.now() / 1000
  );

  if (proSubscription) {
    const expiresAt = new Date(parseInt(String(proSubscription.expires_at)) * 1000).toISOString();
    // Estimate subscription start as 1 year before expiry for annual subscriptions
    const subscribedAt = new Date(parseInt(String(proSubscription.expires_at)) * 1000 - (365 * 24 * 60 * 60 * 1000)).toISOString();
    
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
  userDataMessages: HttpUserDataMessage[],
  verificationMessages: HttpVerificationMessage[],
  followCounts: FollowCounts,
  storageLimits: HttpStorageLimits | null,
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
  
  // Calculate score similar to Neynar's approach
  const baseScore = Math.min(0.99, Math.max(0.1, followCounts.followers / 100000));
  const adjustedScore = Math.min(0.99, baseScore * (1 + (verificationData.allVerifications.length * 0.1)));

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
    verifications: verificationData.ethAddresses, // Match Neynar - only ETH addresses
    verified_addresses: {
      eth_addresses: mergedVerifiedAddresses.eth_addresses,
      sol_addresses: mergedVerifiedAddresses.sol_addresses.slice(0, 1), // Only first SOL address like Neynar
      primary: mergedVerifiedAddresses.primary
    },
    auth_addresses: authAddresses || [],
    verified_accounts: parsedUserData.verified_accounts,
    power_badge: powerBadge,
    score: adjustedScore
  };

  return profile;
}