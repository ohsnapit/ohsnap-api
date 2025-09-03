import type { CastResponse, UserProfile, CastMetrics } from '../types/api.js';
import * as grpc from './grpc.js';
import { buildUserProfile } from '../transformers/userProfile.js';
import { buildCastResponse, calculateMentionRanges } from '../transformers/cast.js';

/**
 * Get enriched user profile data
 */
export async function getEnrichedUserProfile(fid: number): Promise<UserProfile> {
  try {
    const [userDataMessages, verificationMessages, followCounts, storageLimits, custodyAddress, authAddresses] = await Promise.all([
      grpc.getUserDataByFid(fid),
      grpc.getVerificationsByFid(fid),
      grpc.getFollowCounts(fid),
      grpc.getStorageLimitsByFid(fid),
      grpc.getCustodyAddress(fid),
      grpc.getAuthAddresses(fid)
    ]);

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
export async function getCastMetrics(fid: number, hash: string): Promise<CastMetrics> {
  const [repliesCount, reactions] = await Promise.all([
    grpc.getRepliesCount(fid, hash),
    grpc.getReactionsCount(fid, hash)
  ]);

  return {
    repliesCount,
    reactions
  };
}

/**
 * Get complete cast data with all enrichments
 */
export async function getCastByFidAndHash(fid: number, hash: string): Promise<CastResponse> {
  // Get cast data and metrics in parallel
  const [castMessage, authorProfile, metrics] = await Promise.all([
    grpc.getCast(fid, hash),
    getEnrichedUserProfile(fid),
    getCastMetrics(fid, hash)
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
      const mentionedFidStr = castData.mentions[i];
      if (!mentionedFidStr) continue;
      const mentionedFid = parseInt(mentionedFidStr);
      
      try {
        const mentionedProfile = await getEnrichedUserProfile(mentionedFid);
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
    appData = await grpc.getAppProfile(9152); // Warpcast FID
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