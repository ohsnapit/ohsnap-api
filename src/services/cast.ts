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
    const parsedUserData = await parseUserData(userDataMessages);
    const verificationData = parseVerifications(verificationMessages);
    const primaryEthAddress = parsedUserData.verified_addresses?.primary?.eth_address || 
                             verificationData.ethAddresses[0];

    // Get auth addresses using primary ETH address
    const authAddresses = await http.getAuthAddresses(fid, primaryEthAddress);

    return await buildUserProfile(fid, userDataMessages, verificationMessages, followCounts, storageLimits, custodyAddress, authAddresses);
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

/**
 * Get enriched casts by FID with pagination in reverse chronological order
 */
export async function getCastsByFid(
  fid: number,
  pageToken?: string,
  pageSize: number = 25,
  fullCount = false,
  includeReplies = true
): Promise<{casts: CastResponse['cast'][], next: {cursor: string | null}}> {
  try {
    // If we're filtering out replies, we need to fetch more casts to ensure we get enough non-reply casts
    const fetchSize = includeReplies ? pageSize : Math.min(pageSize * 3, 150); // Fetch up to 3x more when filtering replies
    
    // Get casts from HTTP API in reverse chronological order (newest first)
    const response = await http.getCastsByFid(fid, pageToken, fetchSize, true);
    
    if (!response.messages || response.messages.length === 0) {
      return {
        casts: [],
        next: { cursor: null }
      };
    }

    // Get author profile once (since all casts are from same FID)
    const authorProfile = await getEnrichedUserProfile(fid, fullCount);

    // Process each cast
    const enrichedCasts: CastResponse['cast'][] = [];
    let processedCount = 0;
    
    for (const castMessage of response.messages) {
      try {
        if (!castMessage.data?.castAddBody) continue;

        const castData = castMessage.data.castAddBody;
        const hash = castMessage.hash;

        // Filter out replies if includeReplies is false
        if (!includeReplies && castData.parentCastId?.hash) {
          continue; // Skip this cast as it's a reply and replies are not included
        }

        // Stop if we've reached the requested page size
        if (enrichedCasts.length >= pageSize) {
          break;
        }

        // Get cast metrics
        const metrics = await getCastMetrics(fid, hash, fullCount);

        // Build mentioned profiles
        const mentionedProfiles: UserProfile[] = [];
        if (castData.mentions && castData.mentionsPositions) {
          for (let i = 0; i < castData.mentions.length; i++) {
            const mentionedFid = castData.mentions[i];
            if (!mentionedFid) continue;
            
            try {
              const mentionedProfile = await getEnrichedUserProfile(mentionedFid, false);
              mentionedProfiles.push(mentionedProfile);
            } catch (error) {
              console.error(`Failed to get profile for FID ${mentionedFid}:`, error);
            }
          }
        }

        // Calculate mention ranges
        const mentionedProfilesRanges = calculateMentionRanges(castData, mentionedProfiles);

        // Get app data (hardcode Warpcast for now)
        let appData = null;
        try {
          appData = await http.getAppProfile(9152);
        } catch (error) {
          console.error('Failed to get app data:', error);
        }

        // Build cast response
        const castResponse = buildCastResponse(
          castMessage,
          hash,
          authorProfile,
          mentionedProfiles,
          mentionedProfilesRanges,
          metrics,
          appData
        );

        // Extract just the cast data for the array
        enrichedCasts.push(castResponse.cast);
        processedCount++;
      } catch (error) {
        console.error(`Failed to process cast ${castMessage.hash}:`, error);
        // Continue processing other casts
      }
    }

    // For pagination cursor, use the original response cursor only if we haven't filtered
    // or if we processed all available casts. Otherwise, we need more data.
    let nextCursor = response.nextPageToken;
    
    // If we filtered out replies and didn't get enough casts, but there's more data available,
    // we should continue paginating
    if (!includeReplies && enrichedCasts.length < pageSize && response.nextPageToken) {
      nextCursor = response.nextPageToken;
    } else if (enrichedCasts.length < pageSize) {
      // If we got fewer than requested and no more data, no next cursor
      nextCursor = undefined;
    }

    return {
      casts: enrichedCasts,
      next: {
        cursor: nextCursor || null
      }
    };

  } catch (error) {
    console.error(`Failed to get casts for FID ${fid}:`, error);
    return {
      casts: [],
      next: { cursor: null }
    };
  }
}