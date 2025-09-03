import type { CastResponse, UserProfile, CastMetrics } from '../types/api.js';
import type { GrpcCastMessage } from '../types/grpc.js';
import { base64ToHex, farcasterTimestampToISO } from '../utils/converters.js';

/**
 * Build cast response from gRPC data and metrics
 */
export function buildCastResponse(
  castMessage: GrpcCastMessage,
  hashString: string,
  authorProfile: UserProfile,
  mentionedProfiles: UserProfile[],
  mentionedProfilesRanges: Array<{ start: number; end: number }>,
  metrics: CastMetrics
): CastResponse {
  const castData = castMessage.data.castAddBody;
  
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

  // Build embeds
  const embeds = castData.embeds?.map((embed: any) => {
    if (embed.url) return { url: embed.url };
    if (embed.cast_id) {
      return { 
        cast_id: {
          fid: embed.cast_id.fid,
          hash: base64ToHex(embed.cast_id.hash)
        }
      };
    }
    return embed;
  }) || [];

  return {
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
      embeds: embeds,
      reactions: {
        likes_count: metrics.reactions.likes,
        recasts_count: metrics.reactions.recasts,
        likes: [],
        recasts: []
      },
      replies: { count: metrics.repliesCount },
      mentioned_profiles: mentionedProfiles,
      mentioned_profiles_ranges: mentionedProfilesRanges,
      mentioned_channels: [],
      mentioned_channels_ranges: []
    }
  };
}

/**
 * Calculate mention ranges for mentioned profiles
 */
export function calculateMentionRanges(
  castData: any,
  mentionedProfiles: UserProfile[]
): Array<{ start: number; end: number }> {
  const ranges: Array<{ start: number; end: number }> = [];
  
  if (castData.mentions && castData.mentionsPositions) {
    for (let i = 0; i < Math.min(castData.mentions.length, mentionedProfiles.length); i++) {
      const position = castData.mentionsPositions[i];
      const profile = mentionedProfiles[i];
      if (!profile) continue;
      
      ranges.push({
        start: position,
        end: position + (profile.username?.length || 10)
      });
    }
  }
  
  return ranges;
}