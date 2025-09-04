import type { 
  HttpCastMessage, 
  HttpUserDataMessage, 
  HttpVerificationMessage, 
  // HttpLinkMessage, // Now handled by getFastCount
  // HttpReactionMessage, // Now handled by getFastCount
  HttpStorageLimits,
  HttpOnChainEvent,
  HttpResponse,
  // HttpSingleResponse, // Unused
  HttpInfoResponse,
  HttpFidAddressTypeResponse
} from '../types/http.js';
import type { ReactionsCount, FollowCounts } from '../types/api.js';
import { getPaginatedCount } from '../utils/pagination.js';
import { HTTP_BASE_URL } from '../utils/constants.js';

/**
 * Fast count helper - gets up to 10k results (first 10 pages)
 */
async function getFastCount(endpoint: string, params: Record<string, string | number>): Promise<number> {
  let totalCount = 0;
  let pageToken: string | undefined;
  let hasMore = true;
  const maxPages = 10; // 10 pages * 1000 per page = 10k max
  let pageCount = 0;

  while (hasMore && pageCount < maxPages) {
    try {
      const requestParams = {
        ...params,
        pageSize: 1000,
        ...(pageToken && { pageToken })
      };

      const response = await httpRequest<HttpResponse<any>>(endpoint, requestParams);
      
      if (response.messages && response.messages.length > 0) {
        totalCount += response.messages.length;
      }

      // Check if there's more data
      pageToken = response.nextPageToken;
      hasMore = !!pageToken;
      pageCount++;

      // If we got less than pageSize, we're at the end
      if (!response.messages || response.messages.length < 1000) {
        hasMore = false;
      }
    } catch (error) {
      console.error(`Failed to get page ${pageCount} for ${endpoint}:`, error);
      break;
    }
  }

  return totalCount;
}

// const DEFAULT_TIMEOUT = 10000; // Unused

class HttpError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function httpRequest<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  const url = new URL(`/v1/${endpoint}`, HTTP_BASE_URL);
  
  // Add query parameters
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null) {
      url.searchParams.append(key, String(value));
    }
  });

  try {
    const response = await fetch(url.toString(), {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({})) as any;
      throw new HttpError(
        errorData.details || `HTTP ${response.status}: ${response.statusText}`,
        response.status,
        errorData.errCode
      );
    }

    return await response.json() as T;
  } catch (error: any) {
    if (error instanceof HttpError) {
      throw error;
    }
    throw new HttpError(`HTTP request failed: ${error.message}`);
  }
}

/**
 * Get hub info
 */
export async function getInfo(includeDbStats = false): Promise<HttpInfoResponse> {
  return httpRequest<HttpInfoResponse>('info', includeDbStats ? { dbstats: 1 } : {});
}

/**
 * Get cast by FID and hash
 */
export async function getCast(fid: number, hash: string): Promise<HttpCastMessage> {
  return httpRequest<HttpCastMessage>('castById', { fid, hash });
}

/**
 * Get casts by FID in reverse chronological order
 */
export async function getCastsByFid(
  fid: number, 
  pageToken?: string,
  pageSize: number = 25,
  reverse: boolean = true
): Promise<HttpResponse<HttpCastMessage>> {
  const params: Record<string, string | number | boolean> = { 
    fid,
    pageSize,
    reverse
  };
  
  if (pageToken) params.pageToken = pageToken;
  
  return httpRequest<HttpResponse<HttpCastMessage>>('castsByFid', params);
}

/**
 * Get user data by FID
 */
export async function getUserDataByFid(fid: number, userDataType?: string): Promise<HttpUserDataMessage[]> {
  try {
    const params: Record<string, string | number> = { fid };
    if (userDataType) {
      params.user_data_type = userDataType;
    }
    
    const response = await httpRequest<HttpResponse<HttpUserDataMessage>>('userDataByFid', params);
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get user data for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get verifications by FID
 */
export async function getVerificationsByFid(fid: number): Promise<HttpVerificationMessage[]> {
  try {
    const response = await httpRequest<HttpResponse<HttpVerificationMessage>>('verificationsByFid', { fid });
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get verifications for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get storage limits by FID
 */
export async function getStorageLimitsByFid(fid: number): Promise<HttpStorageLimits | null> {
  try {
    return await httpRequest<HttpStorageLimits>('storageLimitsByFid', { fid });
  } catch (error: any) {
    console.error(`Failed to get storage limits for FID ${fid}:`, error.message);
    return null;
  }
}

/**
 * Get on-chain events by FID
 */
export async function getOnChainEventsByFid(fid: number, eventType: string): Promise<HttpOnChainEvent[]> {
  try {
    const response = await httpRequest<HttpResponse<never>>('onChainEventsByFid', { 
      fid, 
      event_type: eventType 
    });
    return response.events || [];
  } catch (error: any) {
    console.error(`Failed to get on-chain events for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get on-chain signers by FID
 */
export async function getOnChainSignersByFid(fid: number): Promise<HttpOnChainEvent[]> {
  try {
    const response = await httpRequest<HttpResponse<never>>('onChainSignersByFid', { fid });
    return response.events || [];
  } catch (error: any) {
    console.error(`Failed to get on-chain signers for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get ID registry event by address
 */
export async function getIdRegistryEventByAddress(address: string): Promise<HttpOnChainEvent | null> {
  try {
    return await httpRequest<HttpOnChainEvent>('onChainIdRegistryEventByAddress', { address });
  } catch (error: any) {
    console.error(`Failed to get ID registry event for address ${address}:`, error.message);
    return null;
  }
}

/**
 * Get FID address type
 */
export async function getFidAddressType(fid: number, address: string): Promise<HttpFidAddressTypeResponse | null> {
  try {
    return await httpRequest<HttpFidAddressTypeResponse>('fidAddressType', { fid, address });
  } catch (error: any) {
    console.error(`Failed to get FID address type for FID ${fid}, address ${address}:`, error.message);
    return null;
  }
}

/**
 * Get custody address by FID
 */
export async function getCustodyAddress(fid: number): Promise<string | null> {
  try {
    const event = await getIdRegistryEventByAddress(''); // We need to find the right approach
    // Alternative: Get on-chain events and find ID register event
    const events = await getOnChainEventsByFid(fid, 'EVENT_TYPE_ID_REGISTER');
    if (events.length > 0 && events[0]?.idRegisterEventBody?.to) {
      return events[0].idRegisterEventBody.to;
    }
    return null;
  } catch (error: any) {
    console.error(`Failed to get custody address for FID ${fid}:`, error.message);
    return null;
  }
}

/**
 * Get replies count for a cast with optional full pagination
 */
export async function getRepliesCount(fid: number, hash: string, fullCount = false): Promise<number> {
  try {
    if (fullCount) {
      // Use full pagination for accurate count (slower)
      return await getPaginatedCount(httpRequest, 'castsByParent', { fid, hash });
    } else {
      // Fast approach - first 10 pages (up to 10k)
      return await getFastCount('castsByParent', { fid, hash });
    }
  } catch (error: any) {
    console.error(`Failed to get replies count:`, error.message);
    return 0;
  }
}

/**
 * Get reactions count for a cast with optional full pagination
 */
export async function getReactionsCount(fid: number, hash: string, fullCount = false): Promise<ReactionsCount> {
  try {
    if (fullCount) {
      // Use full pagination for accurate counts (slower)
      const [likesCount, recastsCount] = await Promise.all([
        getPaginatedCount(httpRequest, 'reactionsByCast', {
          target_fid: fid,
          target_hash: hash,
          reaction_type: 'Like'
        }),
        getPaginatedCount(httpRequest, 'reactionsByCast', {
          target_fid: fid,
          target_hash: hash,
          reaction_type: 'Recast'
        })
      ]);
      
      return {
        likes: likesCount,
        recasts: recastsCount
      };
    } else {
      // Fast approach - first 10 pages (up to 10k each)
      const [likesCount, recastsCount] = await Promise.all([
        getFastCount('reactionsByCast', {
          target_fid: fid,
          target_hash: hash,
          reaction_type: 'Like'
        }),
        getFastCount('reactionsByCast', {
          target_fid: fid,
          target_hash: hash,
          reaction_type: 'Recast'
        })
      ]);
      
      return {
        likes: likesCount,
        recasts: recastsCount
      };
      
    }
  } catch (error: any) {
    console.error(`Failed to get reactions count:`, error.message);
    return { likes: 0, recasts: 0 };
  }
}

/**
 * Get follow counts for a user with optional full pagination
 */
export async function getFollowCounts(fid: number, fullCount = false): Promise<FollowCounts> {
  try {
    if (fullCount) {
      // Use full pagination for accurate counts (slower)
      const [followingCount, followersCount] = await Promise.all([
        getPaginatedCount(httpRequest, 'linksByFid', { fid, link_type: 'follow' }),
        getPaginatedCount(httpRequest, 'linksByTargetFid', { target_fid: fid, link_type: 'follow' })
      ]);
      
      return {
        following: followingCount,
        followers: followersCount
      };
    } else {
      // Fast approach - first 10 pages (up to 10k each)
      const [followingCount, followersCount] = await Promise.all([
        getFastCount('linksByFid', { fid, link_type: 'follow' }),
        getFastCount('linksByTargetFid', { target_fid: fid, link_type: 'follow' })
      ]);
      
      return {
        following: followingCount,
        followers: followersCount
      };
      
    }
  } catch (error: any) {
    console.error(`Failed to get follow counts:`, error.message);
    return { following: 0, followers: 0 };
  }
}


/**
 * Get auth addresses from on-chain signers
 * Returns the primary verified address to match Neynar API behavior
 */
export async function getAuthAddresses(fid: number, primaryEthAddress?: string): Promise<Array<{address: string, app?: any}>> {
  // If we have a primary ETH address, use that as the auth address (matches Neynar behavior)
  if (primaryEthAddress) {
    return [{
      address: primaryEthAddress.toLowerCase(),
      app: {
        object: 'user_dehydrated',
        fid: 9152 // Default to Warpcast for now - would need proper app mapping
      }
    }];
  }

  // Fallback to most recent signer if no primary address
  try {
    const events = await getOnChainSignersByFid(fid);
    const authAddresses: Array<{address: string, app?: any, timestamp: number}> = [];
    
    if (events.length > 0) {
      for (const event of events) {
        if (event.signerEventBody?.key) {
          authAddresses.push({
            address: event.signerEventBody.key,
            app: event.signerEventBody.metadata ? {
              object: 'user_dehydrated',
              fid: 9152 // Default to Warpcast for now - would need proper app mapping
            } : undefined,
            timestamp: event.blockTimestamp
          });
        }
      }
    }
    
    // Sort by timestamp (most recent first) and return only the most recent signer
    if (authAddresses.length > 0) {
      authAddresses.sort((a, b) => b.timestamp - a.timestamp);
      const mostRecentSigner = authAddresses[0];
      if (mostRecentSigner) {
        return [{
          address: mostRecentSigner.address,
          app: mostRecentSigner.app
        }];
      }
    }
    
    return [];
  } catch (error: any) {
    console.error(`Failed to get auth addresses for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get app profile data by FID
 */
export async function getAppProfile(fid: number): Promise<{
  object: string;
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
} | null> {
  try {
    const [userDataMessages, custodyAddress] = await Promise.all([
      getUserDataByFid(fid),
      getCustodyAddress(fid)
    ]);

    if (userDataMessages.length === 0) {
      return null;
    }

    // Parse user data for app info
    let username, display_name, pfp_url;
    for (const message of userDataMessages) {
      const userData = message.data.userDataBody;
      if (!userData) continue;

      switch (userData.type) {
        case 'USER_DATA_TYPE_USERNAME':
          username = userData.value;
          break;
        case 'USER_DATA_TYPE_DISPLAY':
          display_name = userData.value;
          break;
        case 'USER_DATA_TYPE_PFP':
          pfp_url = userData.value;
          break;
      }
    }

    return {
      object: 'user_dehydrated',
      fid,
      username,
      display_name,
      pfp_url,
      custody_address: custodyAddress || undefined
    };
  } catch (error: any) {
    console.error(`Failed to get app profile for FID ${fid}:`, error.message);
    return null;
  }
}