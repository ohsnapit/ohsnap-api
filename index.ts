import { Elysia } from 'elysia';
import { spawn } from 'child_process';
import { promisify } from 'util';
import { exec as execCallback } from 'child_process';

const exec = promisify(execCallback);

interface CastResponse {
  cast: {
    object: string;
    hash: string;
    author: UserProfile;
    app?: UserProfile;
    thread_hash: string;
    parent_hash: string | null;
    parent_url: string | null;
    root_parent_url: string | null;
    parent_author: { fid: number | null };
    text: string;
    timestamp: string;
    embeds: any[];
    channel?: {
      object: string;
      id: string;
      name: string;
      image_url: string;
    };
    reactions: {
      likes_count: number;
      recasts_count: number;
      likes: any[];
      recasts: any[];
    };
    replies: { count: number };
    mentioned_profiles: UserProfile[];
    mentioned_profiles_ranges: Array<{ start: number; end: number }>;
    mentioned_channels: any[];
    mentioned_channels_ranges: any[];
    author_channel_context?: {
      following: boolean;
    };
  };
}

interface UserProfile {
  object: string;
  fid: number;
  username?: string;
  display_name?: string;
  pfp_url?: string;
  custody_address?: string;
  pro?: {
    status: string;
    subscribed_at: string;
    expires_at: string;
  };
  profile?: {
    bio?: { text: string };
    location?: {
      latitude: number;
      longitude: number;
      address: {
        city: string;
        state: string;
        state_code: string;
        country: string;
        country_code: string;
      };
    };
    banner?: { url: string };
  };
  follower_count?: number;
  following_count?: number;
  verifications?: string[];
  verified_addresses?: {
    eth_addresses: string[];
    sol_addresses: string[];
    primary: {
      eth_address: string;
      sol_address: string;
    };
  };
  auth_addresses?: Array<{
    address: string;
    app: { object: string; fid: number };
  }>;
  verified_accounts?: Array<{
    platform: string;
    username: string;
  }>;
  power_badge?: boolean;
  url?: string;
  score?: number;
}

// Helper functions
function hexToBase64(hex: string): string {
  // Remove 0x prefix if present
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return Buffer.from(cleanHex, 'hex').toString('base64');
}

function base64ToHex(base64: string): string {
  return '0x' + Buffer.from(base64, 'base64').toString('hex');
}

function farcasterTimestampToISO(timestamp: number): string {
  // Farcaster epoch starts at Jan 1, 2021 00:00:00 UTC
  const farcasterEpochStart = new Date('2021-01-01T00:00:00.000Z').getTime();
  const actualTimestamp = farcasterEpochStart + (timestamp * 1000);
  return new Date(actualTimestamp).toISOString();
}

async function getCastFromGrpc(fid: number, hash: string): Promise<any> {
  try {
    const base64Hash = hexToBase64(hash);
    const cmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"fid": ${fid}, "hash": "${base64Hash}"}' localhost:3383 HubService/GetCast`;
    
    const { stdout, stderr } = await exec(cmd);
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }
    
    return JSON.parse(stdout);
  } catch (error: any) {
    throw new Error(`gRPC call failed: ${error.message}`);
  }
}

async function getRepliesCount(fid: number, hash: string): Promise<number> {
  try {
    const base64Hash = hexToBase64(hash);
    const cmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"parent_cast_id": {"fid": ${fid}, "hash": "${base64Hash}"}}' localhost:3383 HubService/GetCastsByParent`;
    
    const { stdout, stderr } = await exec(cmd);
    if (stderr && stderr.includes('ERROR')) {
      return 0;
    }
    
    const response = JSON.parse(stdout);
    return response.messages?.length || 0;
  } catch (error: any) {
    console.error(`Failed to get replies count:`, error.message);
    return 0;
  }
}

async function getReactionsCount(fid: number, hash: string): Promise<{likes: number, recasts: number}> {
  try {
    const base64Hash = hexToBase64(hash);
    
    // Get likes and recasts separately as the API requires reaction_type
    const [likesResponse, recastsResponse] = await Promise.all([
      exec(`sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"target_cast_id": {"fid": ${fid}, "hash": "${base64Hash}"}, "reaction_type": "REACTION_TYPE_LIKE"}' localhost:3383 HubService/GetReactionsByCast`, { timeout: 3000 }).catch(() => ({ stdout: '{"messages": []}' })),
      exec(`sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"target_cast_id": {"fid": ${fid}, "hash": "${base64Hash}"}, "reaction_type": "REACTION_TYPE_RECAST"}' localhost:3383 HubService/GetReactionsByCast`, { timeout: 3000 }).catch(() => ({ stdout: '{"messages": []}' }))
    ]);
    
    const likes = JSON.parse(likesResponse.stdout).messages?.length || 0;
    const recasts = JSON.parse(recastsResponse.stdout).messages?.length || 0;
    
    return { likes, recasts };
  } catch (error: any) {
    console.error(`Failed to get reactions count:`, error.message);
    return { likes: 0, recasts: 0 };
  }
}

async function getFollowingCount(fid: number): Promise<{following: number, followers: number}> {
  try {
    // Get following count (users this FID follows) - need to specify link_type
    const followingCmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"fid": ${fid}, "link_type": "follow"}' localhost:3383 HubService/GetLinksByFid`;
    
    const { stdout: followingStdout } = await exec(followingCmd, { timeout: 5000, maxBuffer: 1024 * 1024 * 10 }); // 10MB buffer
    const followingResponse = JSON.parse(followingStdout);
    const followingMessages = followingResponse.messages || [];
    
    // Count only "follow" type links that are additions (not removals)
    const following = followingMessages.filter((msg: any) => 
      msg.data?.linkBody?.type === 'follow' && 
      msg.data?.type === 'MESSAGE_TYPE_LINK_ADD'
    ).length;

    // Get followers count (users that follow this FID)
    const followersCmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"target_fid": ${fid}, "link_type": "follow"}' localhost:3383 HubService/GetLinksByTarget`;
    
    const { stdout: followersStdout } = await exec(followersCmd, { timeout: 5000, maxBuffer: 1024 * 1024 * 10 });
    const followersResponse = JSON.parse(followersStdout);
    const followersMessages = followersResponse.messages || [];
    
    const followers = followersMessages.filter((msg: any) => 
      msg.data?.linkBody?.type === 'follow' && 
      msg.data?.type === 'MESSAGE_TYPE_LINK_ADD'
    ).length;
    
    return { following, followers };
  } catch (error: any) {
    console.error(`Failed to get follow counts:`, error.message);
    return { following: 0, followers: 0 };
  }
}

async function getStorageLimits(fid: number): Promise<any> {
  try {
    const cmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"fid": ${fid}}' localhost:3383 HubService/GetCurrentStorageLimitsByFid`;
    
    const { stdout, stderr } = await exec(cmd);
    if (stderr && stderr.includes('ERROR')) {
      return null;
    }
    
    return JSON.parse(stdout);
  } catch (error: any) {
    console.error(`Failed to get storage limits:`, error.message);
    return null;
  }
}

async function getUserDataFromGrpc(fid: number): Promise<any[]> {
  try {
    const cmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"fid": ${fid}}' localhost:3383 HubService/GetUserDataByFid`;
    
    const { stdout, stderr } = await exec(cmd);
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }
    
    const response = JSON.parse(stdout);
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get user data for FID ${fid}:`, error.message);
    return [];
  }
}

async function getVerificationsFromGrpc(fid: number): Promise<any[]> {
  try {
    const cmd = `sudo docker exec snapchain-ohsnap-snapchain-1 grpcurl -import-path proto -proto proto/rpc.proto -plaintext -d '{"fid": ${fid}}' localhost:3383 HubService/GetVerificationsByFid`;
    
    const { stdout, stderr } = await exec(cmd);
    if (stderr && stderr.includes('ERROR')) {
      throw new Error(stderr);
    }
    
    const response = JSON.parse(stdout);
    return response.messages || [];
  } catch (error: any) {
    console.error(`Failed to get verifications for FID ${fid}:`, error.message);
    return [];
  }
}

function parseUserData(messages: any[]): Partial<UserProfile> {
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

    const type = userData.type;
    const value = userData.value;

    switch (type) {
      case 'USER_DATA_TYPE_USERNAME':
        profile.username = value;
        break;
      case 'USER_DATA_TYPE_DISPLAY':
        profile.display_name = value;
        break;
      case 'USER_DATA_TYPE_PFP':
        profile.pfp_url = value;
        break;
      case 'USER_DATA_TYPE_BIO':
        if (!profile.profile) profile.profile = {};
        profile.profile.bio = { text: value };
        break;
      case 'USER_DATA_TYPE_URL':
        profile.url = value;
        break;
      case 'USER_DATA_TYPE_LOCATION':
        // Parse location string (format: "geo:lat,lng")
        if (value.startsWith('geo:')) {
          const coords = value.slice(4).split(',');
          if (coords.length === 2) {
            if (!profile.profile) profile.profile = {};
            profile.profile.location = {
              latitude: parseFloat(coords[0]),
              longitude: parseFloat(coords[1]),
              address: {
                city: 'Unknown',
                state: 'Unknown',
                state_code: 'unknown',
                country: 'Unknown',
                country_code: 'unknown'
              }
            };
          }
        }
        break;
      case 'USER_DATA_PRIMARY_ADDRESS_ETHEREUM':
        if (profile.verified_addresses) {
          profile.verified_addresses.primary.eth_address = value;
          if (!profile.verified_addresses.eth_addresses.includes(value)) {
            profile.verified_addresses.eth_addresses.push(value);
          }
        }
        break;
      case 'USER_DATA_PRIMARY_ADDRESS_SOLANA':
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

function parseVerifications(messages: any[]): string[] {
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

async function buildUserProfile(fid: number): Promise<UserProfile> {
  try {
    const [userDataMessages, verificationMessages, followCounts, storageLimits] = await Promise.all([
      getUserDataFromGrpc(fid),
      getVerificationsFromGrpc(fid),
      getFollowingCount(fid),
      getStorageLimits(fid)
    ]);

    const parsedUserData = parseUserData(userDataMessages);
    const verifications = parseVerifications(verificationMessages);

    // Check for Pro subscription
    const hasPro = storageLimits?.tierSubscriptions?.some((sub: any) => 
      sub.tierType === 'Pro' && parseInt(sub.expiresAt) > Date.now() / 1000
    );

    // Determine power badge (simplified logic based on follower count and activity)
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
      score: Math.min(0.99, Math.max(0.1, followCounts.followers / 100000)), // Simple score based on followers
      ...(hasPro && {
        pro: {
          status: 'subscribed',
          subscribed_at: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(), // Approximate
          expires_at: new Date(parseInt(storageLimits.tierSubscriptions[0].expiresAt) * 1000).toISOString()
        }
      })
    };

    return profile;
  } catch (error) {
    console.error(`Failed to build user profile for FID ${fid}:`, error);
    // Return minimal profile on error
    return {
      object: 'user',
      fid: fid
    };
  }
}

const app = new Elysia()
  .get('/v1/cast', async ({ query }) => {
    try {
      const { fid, hash } = query;
      
      if (!fid || !hash) {
        return { error: 'fid and hash parameters are required' };
      }

      const fidNumber = parseInt(fid as string);
      const hashString = hash as string;

      // Get cast from gRPC
      const castMessage = await getCastFromGrpc(fidNumber, hashString);
      
      if (!castMessage || !castMessage.data) {
        return { error: 'Cast not found' };
      }

      const castData = castMessage.data.castAddBody;
      if (!castData) {
        return { error: 'Invalid cast data' };
      }

      // Build author profile and get cast metrics in parallel
      const [authorProfile, repliesCount, reactions] = await Promise.all([
        buildUserProfile(fidNumber),
        getRepliesCount(fidNumber, hashString),
        getReactionsCount(fidNumber, hashString)
      ]);
      
      // Build mentioned profiles
      const mentionedProfiles: UserProfile[] = [];
      const mentionedProfilesRanges: Array<{ start: number; end: number }> = [];
      
      if (castData.mentions && castData.mentionsPositions) {
        for (let i = 0; i < castData.mentions.length; i++) {
          const mentionedFid = parseInt(castData.mentions[i]);
          const position = castData.mentionsPositions[i];
          
          try {
            const mentionedProfile = await buildUserProfile(mentionedFid);
            mentionedProfiles.push(mentionedProfile);
            
            // Calculate mention range (simplified)
            mentionedProfilesRanges.push({
              start: position,
              end: position + (mentionedProfile.username?.length || 10)
            });
          } catch (error) {
            console.error(`Failed to get profile for FID ${mentionedFid}:`, error);
          }
        }
      }

      // Parse parent information
      let parentHash = null;
      let parentUrl = null;
      let rootParentUrl = null;
      
      if (castData.parentCastId) {
        parentHash = base64ToHex(castData.parentCastId.hash);
        rootParentUrl = null; // Would need to trace back to root
      } else if (castData.parentUrl) {
        parentUrl = castData.parentUrl;
        rootParentUrl = castData.parentUrl;
      }

      // Build response
      const response: CastResponse = {
        cast: {
          object: 'cast',
          hash: hashString,
          author: authorProfile,
          thread_hash: hashString, // Simplified - would need to find actual thread root
          parent_hash: parentHash,
          parent_url: parentUrl,
          root_parent_url: rootParentUrl,
          parent_author: { fid: null }, // Would need to fetch parent cast
          text: castData.text || '',
          timestamp: farcasterTimestampToISO(castMessage.data.timestamp),
          embeds: castData.embeds?.map((embed: any) => {
            if (embed.url) return { url: embed.url };
            if (embed.cast_id) return { 
              cast_id: {
                fid: embed.cast_id.fid,
                hash: base64ToHex(embed.cast_id.hash)
              }
            };
            return embed;
          }) || [],
          reactions: {
            likes_count: reactions.likes,
            recasts_count: reactions.recasts,
            likes: [],
            recasts: []
          },
          replies: { count: repliesCount },
          mentioned_profiles: mentionedProfiles,
          mentioned_profiles_ranges: mentionedProfilesRanges,
          mentioned_channels: [],
          mentioned_channels_ranges: []
        }
      };

      return response;

    } catch (error: any) {
      console.error('Error fetching cast:', error);
      return { 
        error: 'Internal server error',
        details: error.message 
      };
    }
  })
  .listen(3001);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);