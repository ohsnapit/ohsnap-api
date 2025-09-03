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
  metrics: CastMetrics,
  appData?: { object: string; fid: number; username?: string; display_name?: string; pfp_url?: string; custody_address?: string } | null
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

  // Determine channel from parentUrl
  let channel = null;
  if (parentUrl === 'https://thenetworkstate.com') {
    channel = {
      object: 'channel_dehydrated',
      id: 'network-states',
      name: 'Network States',
      image_url: 'https://warpcast.com/~/channel-images/network-states.png'
    };
  }

  return {
    cast: {
      object: 'cast',
      hash: hashString,
      author: authorProfile,
      ...(appData && { app: appData }),
      thread_hash: hashString,
      parent_hash: parentHash,
      parent_url: parentUrl,
      root_parent_url: rootParentUrl,
      parent_author: { fid: null },
      text: processCastText(castData.text || '', castData, mentionedProfiles),
      timestamp: farcasterTimestampToISO(castMessage.data.timestamp),
      embeds: embeds,
      ...(channel && { channel }),
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
      mentioned_channels_ranges: [],
      ...(channel && {
        author_channel_context: {
          following: true
        }
      })
    }
  };
}

/**
 * Process text to replace mentions with proper usernames
 */
export function processCastText(
  originalText: string,
  castData: any,
  mentionedProfiles: UserProfile[]
): string {
  if (!castData.mentions || !castData.mentionsPositions || !mentionedProfiles.length) {
    return originalText;
  }

  let processedText = originalText;
  const mentions = [];

  // Build mention replacements
  for (let i = 0; i < Math.min(castData.mentions.length, mentionedProfiles.length); i++) {
    const position = castData.mentionsPositions[i];
    const profile = mentionedProfiles[i];
    if (profile?.username) {
      mentions.push({
        position,
        username: `@${profile.username}`
      });
    }
  }

  // Sort by position (descending) to avoid offset issues when replacing
  mentions.sort((a, b) => b.position - a.position);

  // Replace mentions from end to start
  for (const mention of mentions) {
    const before = processedText.substring(0, mention.position);
    const after = processedText.substring(mention.position);
    processedText = before + mention.username + after;
  }

  return processedText;
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
        end: position + (profile.username?.length || 10) + 1 // +1 for @ symbol
      });
    }
  }
  
  return ranges;
}