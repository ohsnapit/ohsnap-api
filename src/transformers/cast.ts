import type { CastResponse, UserProfile, CastMetrics } from '../types/api.js';
import type { HttpCastMessage } from '../types/http.js';
import { base64ToHex, farcasterTimestampToISO } from '../utils/converters.js';

/**
 * Build cast response from HTTP data and metrics
 */
export function buildCastResponse(
  castMessage: HttpCastMessage,
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
    // HTTP format already has hex
    parentHash = castData.parentCastId.hash;
    rootParentUrl = null; // Would need to trace back to root
  } else if (castData.parentUrl) {
    parentUrl = castData.parentUrl;
    rootParentUrl = castData.parentUrl;
  }

  // Build embeds with metadata structure to match Neynar
  const embeds = castData.embeds?.map((embed: any) => {
    if (embed.url) {
      // For now, return basic structure - in production you'd fetch actual metadata
      const isImage = embed.url.includes('imagedelivery.net') || 
                     embed.url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i);
      
      let result: any = { url: embed.url };
      
      if (isImage) {
        result.metadata = {
          content_type: 'image/jpeg',
          content_length: 13719, // Placeholder
          _status: 'RESOLVED',
          image: {
            width_px: 518,  // Placeholder
            height_px: 336  // Placeholder
          }
        };
      }
      
      return result;
    }
    if (embed.cast_id) {
      return { 
        cast_id: {
          fid: embed.cast_id.fid,
          hash: embed.cast_id.hash
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
      channel: channel || null,
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