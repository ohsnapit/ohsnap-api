import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { hexToBase64 } from '../utils/converters.js';
import { GRPC_CONTAINER, GRPC_HOST, EXEC_TIMEOUT, EXEC_MAX_BUFFER, REACTION_TYPES, LINK_TYPES, MESSAGE_TYPES, USER_DATA_TYPES } from '../utils/constants.js';
import type { 
  GrpcCastMessage, 
  GrpcUserDataMessage, 
  GrpcVerificationMessage, 
  GrpcLinkMessage,
  GrpcStorageLimits 
} from '../types/grpc.js';
import type { ReactionsCount, FollowCounts } from '../types/api.js';

const exec = promisify(execCallback);

/**
 * Execute gRPC command via docker
 */
async function execGrpcCommand(command: string, timeout = EXEC_TIMEOUT): Promise<any> {
  const fullCommand = `sudo docker exec ${GRPC_CONTAINER} grpcurl -import-path proto -proto proto/rpc.proto -plaintext ${command}`;
  
  try {
    const { stdout, stderr } = await exec(fullCommand, { 
      timeout, 
      maxBuffer: EXEC_MAX_BUFFER 
    });
    
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error: any) {
    throw new Error(`gRPC call failed: ${error.message}`);
  }
}

/**
 * Execute paginated gRPC command to get all data
 */
async function execPaginatedGrpddoncCommand(endpoint: string, requestData: any, timeout = EXEC_TIMEOUT): Promise<any[]> {
  let allMessages: any[] = [];
  let pageToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    try {
      const request = { ...requestData, page_size: 1000 };
      if (pageToken) {
        request.page_token = pageToken;
      }

      const response = await execGrpcCommand(
        `-d '${JSON.stringify(request)}' localhost:3383 ${endpoint}`,
        timeout
      );

      if (response.messages && response.messages.length > 0) {
        allMessages.push(...response.messages);
      }

      // Check if there's more data
      pageToken = response.nextPageToken || response.next_page_token;
      hasMore = !!pageToken;

      // Safety limit to prevent memory issues  
      if (allMessages.length > 1000000) {
        console.warn(`Pagination stopped at ${allMessages.length} messages for endpoint ${endpoint}`);
        break;
      }
    } catch (error: any) {
      console.error(`Paginated gRPC call failed for ${endpoint}:`, error.message);
      break;
    }
  }

  return allMessages;
}


/**
 * Get cast by FID and hash
 */
export async function getCast(fid: number, hash: string): Promise<GrpcCastMessage> {
  const base64Hash = hexToBase64(hash);
  const data = JSON.stringify({ fid, hash: base64Hash });
  const command = `-d '${data}' localhost:3383 HubService/GetCast`;
  
  return execGrpcCommand(command);
}

/**
 * Get user data by FID
 */
export async function getUserDataByFid(fid: number): Promise<GrpcUserDataMessage[]> {
  const data = JSON.stringify({ fid });
  const command = `-d '${data}' localhost:3383 HubService/GetUserDataByFid`;
  
  try {
    const response = await execGrpcCommand(command);
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get user data for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get verifications by FID
 */
export async function getVerificationsByFid(fid: number): Promise<GrpcVerificationMessage[]> {
  const data = JSON.stringify({ fid });
  const command = `-d '${data}' localhost:3383 HubService/GetVerificationsByFid`;
  
  try {
    const response = await execGrpcCommand(command);
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get verifications for FID ${fid}:`, error.message);
    return [];
  }
}

/**
 * Get custody address by FID
 */
export async function getCustodyAddress(fid: number): Promise<string | null> {
  const data = JSON.stringify({ fid });
  const command = `-d '${data}' localhost:3383 HubService/GetIdRegistryOnChainEvent`;
  
  try {
    const response = await execGrpcCommand(command);
    if (response.idRegisterEventBody?.to) {
      return '0x' + Buffer.from(response.idRegisterEventBody.to, 'base64').toString('hex');
    }
    return null;
  } catch (error: any) {
    console.error(`Failed to get custody address for FID ${fid}:`, error.message);
    return null;
  }
}

/**
 * Get storage limits by FID
 */
export async function getStorageLimitsByFid(fid: number): Promise<GrpcStorageLimits | null> {
  const data = JSON.stringify({ fid });
  const command = `-d '${data}' localhost:3383 HubService/GetCurrentStorageLimitsByFid`;
  
  try {
    return await execGrpcCommand(command);
  } catch (error: any) {
    console.error(`Failed to get storage limits for FID ${fid}:`, error.message);
    return null;
  }
}

/**
 * Get replies count for a cast
 */
export async function getRepliesCount(fid: number, hash: string): Promise<number> {
  const base64Hash = hexToBase64(hash);
  const data = JSON.stringify({ parent_cast_id: { fid, hash: base64Hash } });
  const command = `-d '${data}' localhost:3383 HubService/GetCastsByParent`;
  
  try {
    const response = await execGrpcCommand(command);
    return response.messages?.length || 0;
  } catch (error: any) {
    console.error(`Failed to get replies count:`, error.message);
    return 0;
  }
}

/**
 * Get reactions count for a cast
 */
export async function getReactionsCount(fid: number, hash: string): Promise<ReactionsCount> {
  const base64Hash = hexToBase64(hash);
  
  try {
    const [likesResponse, recastsResponse] = await Promise.all([
      execGrpcCommand(
        `-d '${JSON.stringify({ 
          target_cast_id: { fid, hash: base64Hash }, 
          reaction_type: REACTION_TYPES.LIKE 
        })}' localhost:3383 HubService/GetReactionsByCast`, 
        3000
      ).catch(() => ({ messages: [] })),
      execGrpcCommand(
        `-d '${JSON.stringify({ 
          target_cast_id: { fid, hash: base64Hash }, 
          reaction_type: REACTION_TYPES.RECAST 
        })}' localhost:3383 HubService/GetReactionsByCast`, 
        3000
      ).catch(() => ({ messages: [] }))
    ]);
    
    return {
      likes: likesResponse.messages?.length || 0,
      recasts: recastsResponse.messages?.length || 0
    };
  } catch (error: any) {
    console.error(`Failed to get reactions count:`, error.message);
    return { likes: 0, recasts: 0 };
  }
}

/**
 * Get auth addresses from on-chain signers
 */
export async function getAuthAddresses(fid: number): Promise<Array<{address: string, app?: any}>> {
  const data = JSON.stringify({ fid });
  const command = `-d '${data}' localhost:3383 HubService/GetOnChainSignersByFid`;
  
  try {
    const response = await execGrpcCommand(command);
    const authAddresses: Array<{address: string, app?: any}> = [];
    
    if (response.events) {
      for (const event of response.events) {
        if (event.signerEventBody?.key) {
          // Convert base64-encoded key to hex address format
          try {
            const decodedKey = Buffer.from(event.signerEventBody.key, 'base64');
            const hexAddress = '0x' + decodedKey.toString('hex');
            authAddresses.push({
              address: hexAddress,
              app: event.signerEventBody.metadata ? {
                object: 'user_dehydrated',
                fid: 9152 // Default to Warpcast for now - would need proper app mapping
              } : undefined
            });
          } catch (decodeError) {
            // If decoding fails, keep the original base64 format
            authAddresses.push({
              address: event.signerEventBody.key,
              app: undefined
            });
          }
        }
      }
    }
    
    return authAddresses;
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
        case USER_DATA_TYPES.USERNAME:
          username = userData.value;
          break;
        case USER_DATA_TYPES.DISPLAY:
          display_name = userData.value;
          break;
        case USER_DATA_TYPES.PFP:
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

/**
 * Get follow counts for a user
 */
export async function getFollowCounts(fid: number): Promise<FollowCounts> {
  try {
    const [followingResponse, followersResponse] = await Promise.all([
      execGrpcCommand(
        `-d '${JSON.stringify({ fid, link_type: LINK_TYPES.FOLLOW })}' localhost:3383 HubService/GetLinksByFid`
      ).catch(() => ({ messages: [] })),
      execGrpcCommand(
        `-d '${JSON.stringify({ target_fid: fid, link_type: LINK_TYPES.FOLLOW })}' localhost:3383 HubService/GetLinksByTarget`
      ).catch(() => ({ messages: [] }))
    ]);
    
    return {
      following: followingResponse.messages?.length || 0,
      followers: followersResponse.messages?.length || 0
    };
  } catch (error: any) {
    console.error(`Failed to get follow counts:`, error.message);
    return { following: 0, followers: 0 };
  }
}