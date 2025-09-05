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
import { startTimer, logHttpRequest, logHttpResponse, logError, logServiceMethod } from '../utils/logger.js';
import { withSpan, addBreadcrumb } from '../utils/tracing.js';

/**
 * Fast count helper - gets up to 1k results (first page only for speed)
 */
async function getFastCount(endpoint: string, params: Record<string, string | number>): Promise<number> {
  return withSpan(
    'http.fast_count',
    `Fast count for ${endpoint}`,
    async () => {
      const timer = startTimer('fast_count', { endpoint, params });
      logServiceMethod('http', 'getFastCount', { endpoint, params });
      addBreadcrumb(`Getting fast count for ${endpoint}`, 'http', 'info', { endpoint, params });
      
      let totalCount = 0;
      let pageToken: string | undefined;
      let hasMore = true;
      const maxPages = 1; // 1 page * 500 per page = 500 max (much faster)
      let pageCount = 0;

      while (hasMore && pageCount < maxPages) {
        try {
          const requestParams = {
            ...params,
            pageSize: 500,
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
        } catch (error: any) {
          logError(error, 'getFastCount', { endpoint, params, pageCount, totalCount });
          break;
        }
      }

      timer.end({ 
        totalCount, 
        pagesProcessed: pageCount, 
        hitMaxPages: pageCount >= maxPages,
        endpoint 
      });
      
      return totalCount;
    },
    { endpoint, params }
  );
}

// const DEFAULT_TIMEOUT = 10000; // Unused

class HttpError extends Error {
  constructor(message: string, public status?: number, public code?: string) {
    super(message);
    this.name = 'HttpError';
  }
}

async function httpRequest<T>(endpoint: string, params: Record<string, string | number | boolean> = {}): Promise<T> {
  return withSpan(
    'http.client',
    `HTTP request to ${endpoint}`,
    async () => {
      const timer = startTimer('http_request', { endpoint, params });
      const url = new URL(`/v1/${endpoint}`, HTTP_BASE_URL);
      
      // Add query parameters
      Object.entries(params).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          url.searchParams.append(key, String(value));
        }
      });

      logHttpRequest('GET', url.toString(), { endpoint, params });
      addBreadcrumb(`HTTP request to ${endpoint}`, 'http', 'info', { endpoint, params });

      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        });

        const duration = timer.end({ statusCode: response.status });
        logHttpResponse('GET', url.toString(), response.status, duration, { endpoint });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({})) as any;
          const error = new HttpError(
            errorData.details || `HTTP ${response.status}: ${response.statusText}`,
            response.status,
            errorData.errCode
          );
          logError(error, 'httpRequest', { endpoint, statusCode: response.status });
          throw error;
        }

        return await response.json() as T;
      } catch (error: any) {
        timer.end({ error: error.message });
        if (error instanceof HttpError) {
          throw error;
        }
        const httpError = new HttpError(`HTTP request failed: ${error.message}`);
        logError(httpError, 'httpRequest', { endpoint });
        throw httpError;
      }
    },
    { endpoint, params }
  );
}

/**
 * Get hub info
 */
export async function getInfo(includeDbStats = false): Promise<HttpInfoResponse> {
  logServiceMethod('http', 'getInfo', { includeDbStats });
  return httpRequest<HttpInfoResponse>('info', includeDbStats ? { dbstats: 1 } : {});
}

/**
 * Get cast by FID and hash
 */
export async function getCast(fid: number, hash: string): Promise<HttpCastMessage> {
  return withSpan(
    'http.cast.get',
    `Get cast by FID ${fid} and hash ${hash}`,
    async () => {
      logServiceMethod('http', 'getCast', { fid, hash });
      addBreadcrumb(`Getting cast for FID ${fid}`, 'http', 'info', { fid, hash });
      return httpRequest<HttpCastMessage>('castById', { fid, hash });
    },
    { fid, hash }
  );
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
  return withSpan(
    'http.casts.list',
    `Get casts for FID ${fid} with pagination`,
    async () => {
      logServiceMethod('http', 'getCastsByFid', { fid, pageSize, reverse, hasPageToken: !!pageToken });
      addBreadcrumb(`Getting casts for FID ${fid}`, 'http', 'info', { fid, pageSize, reverse, hasPageToken: !!pageToken });
      
      const params: Record<string, string | number | boolean> = { 
        fid,
        pageSize,
        reverse
      };
      
      if (pageToken) params.pageToken = pageToken;
      
      return httpRequest<HttpResponse<HttpCastMessage>>('castsByFid', params);
    },
    { fid, pageSize, reverse, hasPageToken: !!pageToken }
  );
}

/**
 * Get user data by FID
 */
export async function getUserDataByFid(fid: number, userDataType?: string): Promise<HttpUserDataMessage[]> {
  return withSpan(
    'http.user.data.get',
    `Get user data for FID ${fid}`,
    async () => {
      const timer = startTimer('get_user_data_by_fid', { fid, userDataType });
      logServiceMethod('http', 'getUserDataByFid', { fid, userDataType });
      addBreadcrumb(`Getting user data for FID ${fid}`, 'http', 'info', { fid, userDataType });
      
      try {
        const params: Record<string, string | number> = { fid };
        if (userDataType) {
          params.user_data_type = userDataType;
        }
        
        const response = await httpRequest<HttpResponse<HttpUserDataMessage>>('userDataByFid', params);
        const result = response.messages || [];
        timer.end({ messageCount: result.length });
        return result;
      } catch (error: any) {
        logError(error, 'getUserDataByFid', { fid, userDataType });
        timer.end({ error: error.message });
        return [];
      }
    },
    { fid, userDataType }
  );
}

/**
 * Get verifications by FID
 */
export async function getVerificationsByFid(fid: number): Promise<HttpVerificationMessage[]> {
  const timer = startTimer('get_verifications_by_fid', { fid });
  logServiceMethod('http', 'getVerificationsByFid', { fid });
  
  try {
    const response = await httpRequest<HttpResponse<HttpVerificationMessage>>('verificationsByFid', { fid });
    const result = response.messages || [];
    timer.end({ messageCount: result.length });
    return result;
  } catch (error: any) {
    logError(error, 'getVerificationsByFid', { fid });
    timer.end({ error: error.message });
    return [];
  }
}

/**
 * Get storage limits by FID
 */
export async function getStorageLimitsByFid(fid: number): Promise<HttpStorageLimits | null> {
  const timer = startTimer('get_storage_limits_by_fid', { fid });
  logServiceMethod('http', 'getStorageLimitsByFid', { fid });
  
  try {
    const result = await httpRequest<HttpStorageLimits>('storageLimitsByFid', { fid });
    timer.end({ success: true });
    return result;
  } catch (error: any) {
    logError(error, 'getStorageLimitsByFid', { fid });
    timer.end({ error: error.message });
    return null;
  }
}

/**
 * Get on-chain events by FID
 */
export async function getOnChainEventsByFid(fid: number, eventType: string): Promise<HttpOnChainEvent[]> {
  const timer = startTimer('get_onchain_events_by_fid', { fid, eventType });
  logServiceMethod('http', 'getOnChainEventsByFid', { fid, eventType });
  
  try {
    const response = await httpRequest<HttpResponse<never>>('onChainEventsByFid', { 
      fid, 
      event_type: eventType 
    });
    const result = response.events || [];
    timer.end({ eventCount: result.length });
    return result;
  } catch (error: any) {
    logError(error, 'getOnChainEventsByFid', { fid, eventType });
    timer.end({ error: error.message });
    return [];
  }
}

/**
 * Get on-chain signers by FID
 */
export async function getOnChainSignersByFid(fid: number): Promise<HttpOnChainEvent[]> {
  const timer = startTimer('get_onchain_signers_by_fid', { fid });
  logServiceMethod('http', 'getOnChainSignersByFid', { fid });
  
  try {
    const response = await httpRequest<HttpResponse<never>>('onChainSignersByFid', { fid });
    const result = response.events || [];
    timer.end({ signerCount: result.length });
    return result;
  } catch (error: any) {
    logError(error, 'getOnChainSignersByFid', { fid });
    timer.end({ error: error.message });
    return [];
  }
}

/**
 * Get ID registry event by address
 */
export async function getIdRegistryEventByAddress(address: string): Promise<HttpOnChainEvent | null> {
  const timer = startTimer('get_id_registry_event_by_address', { address });
  logServiceMethod('http', 'getIdRegistryEventByAddress', { address });
  
  try {
    const result = await httpRequest<HttpOnChainEvent>('onChainIdRegistryEventByAddress', { address });
    timer.end({ found: !!result });
    return result;
  } catch (error: any) {
    logError(error, 'getIdRegistryEventByAddress', { address });
    timer.end({ error: error.message });
    return null;
  }
}

/**
 * Get FID address type
 */
export async function getFidAddressType(fid: number, address: string): Promise<HttpFidAddressTypeResponse | null> {
  const timer = startTimer('get_fid_address_type', { fid, address });
  logServiceMethod('http', 'getFidAddressType', { fid, address });
  
  try {
    const result = await httpRequest<HttpFidAddressTypeResponse>('fidAddressType', { fid, address });
    timer.end({ found: !!result });
    return result;
  } catch (error: any) {
    logError(error, 'getFidAddressType', { fid, address });
    timer.end({ error: error.message });
    return null;
  }
}

/**
 * Get custody address by FID
 */
export async function getCustodyAddress(fid: number): Promise<string | null> {
  const timer = startTimer('get_custody_address', { fid });
  logServiceMethod('http', 'getCustodyAddress', { fid });
  
  try {
    const event = await getIdRegistryEventByAddress(''); // We need to find the right approach
    // Alternative: Get on-chain events and find ID register event
    const events = await getOnChainEventsByFid(fid, 'EVENT_TYPE_ID_REGISTER');
    if (events.length > 0 && events[0]?.idRegisterEventBody?.to) {
      const address = events[0].idRegisterEventBody.to;
      timer.end({ found: true, address });
      return address;
    }
    timer.end({ found: false });
    return null;
  } catch (error: any) {
    logError(error, 'getCustodyAddress', { fid });
    timer.end({ error: error.message });
    return null;
  }
}

/**
 * Get replies count for a cast with optional full pagination
 */
export async function getRepliesCount(fid: number, hash: string, fullCount = false): Promise<number> {
  const timer = startTimer('get_replies_count', { fid, hash, fullCount });
  logServiceMethod('http', 'getRepliesCount', { fid, hash, fullCount });
  
  try {
    let count: number;
    if (fullCount) {
      // Use full pagination for accurate count (slower)
      count = await getPaginatedCount(httpRequest, 'castsByParent', { fid, hash });
    } else {
      // Fast approach - first page only (up to 1k)
      count = await getFastCount('castsByParent', { fid, hash });
    }
    
    timer.end({ count, method: fullCount ? 'full' : 'fast' });
    return count;
  } catch (error: any) {
    logError(error, 'getRepliesCount', { fid, hash, fullCount });
    timer.end({ error: error.message });
    return 0;
  }
}

/**
 * Get reactions count for a cast with optional full pagination
 */
export async function getReactionsCount(fid: number, hash: string, fullCount = false): Promise<ReactionsCount> {
  const timer = startTimer('get_reactions_count', { fid, hash, fullCount });
  logServiceMethod('http', 'getReactionsCount', { fid, hash, fullCount });
  
  try {
    let result: ReactionsCount;
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
      
      result = {
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
      
      result = {
        likes: likesCount,
        recasts: recastsCount
      };
    }
    
    timer.end({ likes: result.likes, recasts: result.recasts, method: fullCount ? 'full' : 'fast' });
    return result;
  } catch (error: any) {
    logError(error, 'getReactionsCount', { fid, hash, fullCount });
    timer.end({ error: error.message });
    return { likes: 0, recasts: 0 };
  }
}

/**
 * Get follow counts for a user with optional full pagination
 */
export async function getFollowCounts(fid: number, fullCount = false): Promise<FollowCounts> {
  return withSpan(
    'http.user.follows.get',
    `Get follow counts for FID ${fid}`,
    async () => {
      const timer = startTimer('get_follow_counts', { fid, fullCount });
      logServiceMethod('http', 'getFollowCounts', { fid, fullCount });
      addBreadcrumb(`Getting follow counts for FID ${fid}`, 'http', 'info', { fid, fullCount });
      
      try {
        if (fullCount) {
          // Use full pagination for accurate counts (slower)
          const [followingCount, followersCount] = await Promise.all([
            getPaginatedCount(httpRequest, 'linksByFid', { fid, link_type: 'follow' }),
            getPaginatedCount(httpRequest, 'linksByTargetFid', { target_fid: fid, link_type: 'follow' })
          ]);
          
          const result = {
            following: followingCount,
            followers: followersCount
          };
          
          timer.end({ following: followingCount, followers: followersCount, method: 'full' });
          return result;
        } else {
          // Fast approach - first page only (up to 1k each)
          const [followingCount, followersCount] = await Promise.all([
            getFastCount('linksByFid', { fid, link_type: 'follow' }),
            getFastCount('linksByTargetFid', { target_fid: fid, link_type: 'follow' })
          ]);
          
          const result = {
            following: followingCount,
            followers: followersCount
          };
          
          timer.end({ following: followingCount, followers: followersCount, method: 'fast' });
          return result;
        }
      } catch (error: any) {
        logError(error, 'getFollowCounts', { fid, fullCount });
        timer.end({ error: error.message });
        return { following: 0, followers: 0 };
      }
    },
    { fid, fullCount }
  );
}


/**
 * Get auth addresses from on-chain signers
 * Returns the primary verified address to match Neynar API behavior
 */
export async function getAuthAddresses(fid: number, primaryEthAddress?: string): Promise<Array<{address: string, app?: any}>> {
  const timer = startTimer('get_auth_addresses', { fid, hasPrimaryEthAddress: !!primaryEthAddress });
  logServiceMethod('http', 'getAuthAddresses', { fid, hasPrimaryEthAddress: !!primaryEthAddress });
  
  // If we have a primary ETH address, use that as the auth address (matches Neynar behavior)
  if (primaryEthAddress) {
    const result = [{
      address: primaryEthAddress.toLowerCase(),
      app: {
        object: 'user_dehydrated',
        fid: 9152 // Default to Warpcast for now - would need proper app mapping
      }
    }];
    timer.end({ addressCount: 1, source: 'primary_eth' });
    return result;
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
        const result = [{
          address: mostRecentSigner.address,
          app: mostRecentSigner.app
        }];
        timer.end({ addressCount: 1, source: 'recent_signer' });
        return result;
      }
    }
    
    timer.end({ addressCount: 0 });
    return [];
  } catch (error: any) {
    logError(error, 'getAuthAddresses', { fid, hasPrimaryEthAddress: !!primaryEthAddress });
    timer.end({ error: error.message });
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
  const timer = startTimer('get_app_profile', { fid });
  logServiceMethod('http', 'getAppProfile', { fid });
  
  try {
    const [userDataMessages, custodyAddress] = await Promise.all([
      getUserDataByFid(fid),
      getCustodyAddress(fid)
    ]);

    if (userDataMessages.length === 0) {
      timer.end({ found: false, reason: 'no_user_data' });
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

    const result = {
      object: 'user_dehydrated',
      fid,
      username,
      display_name,
      pfp_url,
      custody_address: custodyAddress || undefined
    };
    
    timer.end({ found: true, hasUsername: !!username, hasDisplayName: !!display_name });
    return result;
  } catch (error: any) {
    logError(error, 'getAppProfile', { fid });
    timer.end({ error: error.message });
    return null;
  }
}