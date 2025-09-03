export interface CastResponse {
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
    channel: {
      object: string;
      id: string;
      name: string;
      image_url: string;
    } | null;
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

export interface UserProfile {
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
    app?: { object: string; fid: number };
  }>;
  verified_accounts?: Array<{
    platform: string;
    username: string;
  }>;
  power_badge?: boolean;
  url?: string;
  score?: number;
}

export interface ReactionsCount {
  likes: number;
  recasts: number;
}

export interface FollowCounts {
  following: number;
  followers: number;
}

export interface CastMetrics {
  repliesCount: number;
  reactions: ReactionsCount;
}