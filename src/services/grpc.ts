import { promisify } from 'util';
import { exec as execCallback } from 'child_process';
import { hexToBase64 } from '../utils/converters.js';
import { GRPC_CONTAINER, GRPC_HOST, EXEC_TIMEOUT, EXEC_MAX_BUFFER, REACTION_TYPES, LINK_TYPES } from '../utils/constants.js';
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
 * Get follow counts for a user
 */
export async function getFollowCounts(fid: number): Promise<FollowCounts> {
  try {
    const [followingResponse, followersResponse] = await Promise.all([
      // Users this FID follows
      execGrpcCommand(
        `-d '${JSON.stringify({ fid, link_type: LINK_TYPES.FOLLOW })}' localhost:3383 HubService/GetLinksByFid`,
        EXEC_TIMEOUT
      ).catch(() => ({ messages: [] })),
      // Users that follow this FID  
      execGrpcCommand(
        `-d '${JSON.stringify({ target_fid: fid, link_type: LINK_TYPES.FOLLOW })}' localhost:3383 HubService/GetLinksByTarget`,
        EXEC_TIMEOUT
      ).catch(() => ({ messages: [] }))
    ]);
    
    const following = followingResponse.messages?.filter((msg: any) => 
      msg.data?.linkBody?.type === LINK_TYPES.FOLLOW && 
      msg.data?.type === 'MESSAGE_TYPE_LINK_ADD'
    ).length || 0;
    
    const followers = followersResponse.messages?.filter((msg: any) => 
      msg.data?.linkBody?.type === LINK_TYPES.FOLLOW && 
      msg.data?.type === 'MESSAGE_TYPE_LINK_ADD'
    ).length || 0;
    
    return { following, followers };
  } catch (error: any) {
    console.error(`Failed to get follow counts:`, error.message);
    return { following: 0, followers: 0 };
  }
}