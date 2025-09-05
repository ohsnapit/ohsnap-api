import type { CastResponse, UserProfile, CastMetrics } from '../types/api.js';
import type { HttpCastMessage } from '../types/http.js';
import { farcasterTimestampToISO } from '../utils/converters.js';
import { startTimer, logTransformation, logError } from '../utils/logger.js';

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
  const timer = startTimer('build_cast_response', {
    hash: hashString,
    authorFid: authorProfile.fid,
    mentionedCount: mentionedProfiles.length,
    rangesCount: mentionedProfilesRanges.length,
    hasApp: !!appData,
    likesCount: metrics.reactions.likes,
    recastsCount: metrics.reactions.recasts,
    repliesCount: metrics.repliesCount
  });
  logTransformation('buildCastResponse', 1);
  
  try {
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
      // Detect image URLs by checking for image hosting domains or file extensions
      const isImage = embed.url.includes('imagedelivery.net') || 
                     embed.url.includes('imgur.com') ||
                     embed.url.match(/\.(jpg|jpeg|png|gif|webp)($|\?)/i);
      
      let result: any = { url: embed.url };
      
      if (isImage) {
        result.metadata = {
          content_type: 'image/jpeg_placeholder',
          content_length: 13719,
          _status: 'RESOLVED_placeholder',
          image: {
            width_px: 518,
            height_px: 336
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

  // Determine channel from parentUrl dynamically
  let channel: { object: string; id: string; name: string; image_url: string } | null = null;
  if (parentUrl) {
    channel = extractChannelFromUrl(parentUrl);
  }

    const result = {
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
        channel: channel ?? null,
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
        author_channel_context: channel ? {
          following: true
        } : undefined
      }
    };
    
    timer.end({
      success: true,
      hasParent: !!parentHash || !!parentUrl,
      embedsCount: embeds.length,
      hasChannel: !!channel,
      textLength: (castData.text || '').length
    });
    return result;
  } catch (error: any) {
    logError(error, 'buildCastResponse', { hash: hashString, authorFid: authorProfile.fid });
    timer.end({ error: error.message });
    throw error;
  }
}

/**
 * Process text to replace mentions with proper usernames
 */
export function processCastText(
  originalText: string,
  castData: any,
  mentionedProfiles: UserProfile[]
): string {
  const timer = startTimer('process_cast_text', {
    textLength: originalText.length,
    mentionsCount: castData.mentions?.length || 0,
    mentionPositionsCount: castData.mentionsPositions?.length || 0,
    profilesCount: mentionedProfiles.length
  });
  logTransformation('processCastText', mentionedProfiles.length);
  
  try {
    if (!castData.mentions || !castData.mentionsPositions || !mentionedProfiles.length) {
      timer.end({ processed: false, reason: 'no_mentions_or_profiles' });
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

    timer.end({ processed: true, mentionsReplaced: mentions.length, finalTextLength: processedText.length });
    return processedText;
  } catch (error: any) {
    logError(error, 'processCastText', { textLength: originalText.length, mentionsCount: castData.mentions?.length });
    timer.end({ error: error.message });
    return originalText; // Return original text on error
  }
}

/**
 * Extract channel information from parentUrl dynamically
 */
function extractChannelFromUrl(parentUrl: string): { object: string; id: string; name: string; image_url: string } | null {
  const timer = startTimer('extract_channel_from_url', { parentUrl });
  logTransformation('extractChannelFromUrl', 1);
  
  try {
    const url = new URL(parentUrl);
    
    // Handle Warpcast channel URLs: https://warpcast.com/~/channel/channelname
    if (url.hostname === 'warpcast.com' && url.pathname.startsWith('/~/channel/')) {
      const channelId = url.pathname.split('/~/channel/')[1];
      if (channelId && channelId.trim()) {
        const result = {
          object: 'channel_dehydrated',
          id: channelId,
          name: channelId.charAt(0).toUpperCase() + channelId.slice(1).replace(/-/g, ' '),
          image_url: `https://warpcast.com/~/channel-images/${channelId}.png`
        };
        timer.end({ success: true, channelType: 'warpcast', channelId });
        return result;
      }
    }
    
    // For any other URL, extract domain-based channel info
    const domain = url.hostname.replace('www.', '');
    const channelId = domain.split('.')[0];
    
    if (channelId && channelId.trim()) {
      const result = {
        object: 'channel_dehydrated',
        id: channelId,
        name: channelId.charAt(0).toUpperCase() + channelId.slice(1),
        image_url: `https://warpcast.com/~/channel-images/${channelId}.png_placeholder`
      };
      timer.end({ success: true, channelType: 'domain', channelId, domain });
      return result;
    }
    
    timer.end({ success: false, reason: 'no_valid_channel_id' });
    return null;
  } catch (error: any) {
    logError(error, 'extractChannelFromUrl', { parentUrl });
    timer.end({ error: error.message });
    return null;
  }
}

/**
 * Calculate mention ranges for mentioned profiles
 */
export function calculateMentionRanges(
  castData: any,
  mentionedProfiles: UserProfile[]
): Array<{ start: number; end: number }> {
  const timer = startTimer('calculate_mention_ranges', {
    mentionsCount: castData.mentions?.length || 0,
    mentionPositionsCount: castData.mentionsPositions?.length || 0,
    profilesCount: mentionedProfiles.length
  });
  logTransformation('calculateMentionRanges', mentionedProfiles.length);
  
  try {
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
  
    timer.end({ success: true, rangesCalculated: ranges.length });
    return ranges;
  } catch (error: any) {
    logError(error, 'calculateMentionRanges', { mentionsCount: castData.mentions?.length, profilesCount: mentionedProfiles.length });
    timer.end({ error: error.message });
    return [];
  }
}