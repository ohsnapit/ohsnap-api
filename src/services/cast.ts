import type { CastResponse, UserProfile, CastMetrics } from '../types/api.js';
import * as http from './http.js';
import { buildUserProfile, parseUserData, parseVerifications } from '../transformers/userProfile.js';
import { buildCastResponse, calculateMentionRanges } from '../transformers/cast.js';

/**
 * Get enriched user profile data
 */
export async function getEnrichedUserProfile(fid: number, fullCount = false): Promise<UserProfile> {
  try {
    const [userDataMessages, verificationMessages, followCounts, storageLimits, custodyAddress] = await Promise.all([
      http.getUserDataByFid(fid),
      http.getVerificationsByFid(fid),
      http.getFollowCounts(fid, fullCount),
      http.getStorageLimitsByFid(fid),
      http.getCustodyAddress(fid)
    ]);

    // Get primary ETH address first to pass to getAuthAddresses
    const parsedUserData = parseUserData(userDataMessages);
    const verificationData = parseVerifications(verificationMessages);
    const primaryEthAddress = parsedUserData.verified_addresses?.primary?.eth_address || 
                             verificationData.ethAddresses[0];

    // Get auth addresses using primary ETH address
    const authAddresses = await http.getAuthAddresses(fid, primaryEthAddress);

    return buildUserProfile(fid, userDataMessages, verificationMessages, followCounts, storageLimits, custodyAddress, authAddresses);
  } catch (error) {
    console.error(`Failed to build user profile for FID ${fid}:`, error);
    // Return minimal profile on error
    return {
      object: 'user',
      fid: fid
    };
  }
}

/**
 * Get cast metrics (replies and reactions)
 */
export async function getCastMetrics(fid: number, hash: string, fullCount = false): Promise<CastMetrics> {
  const [repliesCount, reactions] = await Promise.all([
    http.getRepliesCount(fid, hash, fullCount),
    http.getReactionsCount(fid, hash, fullCount)
  ]);

  return {
    repliesCount,
    reactions
  };
}

/**
 * Get complete cast data with all enrichments
 */
export async function getCastByFidAndHash(fid: number, hash: string, fullCount = false): Promise<CastResponse> {
  // Get cast data and metrics in parallel
  const [castMessage, authorProfile, metrics] = await Promise.all([
    http.getCast(fid, hash),
    getEnrichedUserProfile(fid, fullCount),
    getCastMetrics(fid, hash, fullCount)
  ]);

  if (!castMessage || !castMessage.data) {
    throw new Error('Cast not found');
  }

  const castData = castMessage.data.castAddBody;
  if (!castData) {
    throw new Error('Invalid cast data');
  }

  // Build mentioned profiles
  const mentionedProfiles: UserProfile[] = [];
  
  if (castData.mentions && castData.mentionsPositions) {
    for (let i = 0; i < castData.mentions.length; i++) {
      const mentionedFid = castData.mentions[i];
      if (!mentionedFid) continue;
      
      try {
        const mentionedProfile = await getEnrichedUserProfile(mentionedFid, false); // Don't use full count for mentioned profiles
        mentionedProfiles.push(mentionedProfile);
      } catch (error) {
        console.error(`Failed to get profile for FID ${mentionedFid}:`, error);
      }
    }
  }

  // Calculate mention ranges
  const mentionedProfilesRanges = calculateMentionRanges(castData, mentionedProfiles);

  // Get app data from signer (try to extract app FID from signer key)
  let appData = null;
  try {
    // For now, hardcode Warpcast as default app since signer-to-app mapping is complex
    // In a full implementation, this would require a database of signer keys to app FIDs
    appData = await http.getAppProfile(9152); // Warpcast FID
  } catch (error) {
    console.error('Failed to get app data:', error);
  }

  // Build final response
  return buildCastResponse(
    castMessage,
    hash,
    authorProfile,
    mentionedProfiles,
    mentionedProfilesRanges,
    metrics,
    appData
  );
}