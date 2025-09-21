import { query } from '../utils/db';

import { t } from "elysia"; // or your validator runtime

function mapCastRow(row: any) {
  return {
    object: "cast",
    hash: row.Hash,
    author: {
      object: "user",
      fid: Number(row.Fid),
      username: undefined,
      display_name: undefined,
      pfp_url: undefined,
      custody_address: row.Signer,
      profile: undefined,
      follower_count: undefined,
      following_count: undefined,
      verifications: [],
      verified_addresses: {
        eth_addresses: [],
        sol_addresses: [],
        primary: {
          eth_address: "",
          sol_address: ""
        }
      },
      auth_addresses: [],
      verified_accounts: [],
      power_badge: undefined,
      score: undefined,
      url: undefined,
      pro: undefined
    },
    app: undefined,
    thread_hash: row.TargetHash || row.Hash,
    parent_hash: row.ParentCastId || null,
    parent_url: row.ParentUrl || null,
    root_parent_url: row.ParentUrl || null,
    parent_author: { fid: null },
    text: row.Text,
    timestamp: row.Timestamp,
    embeds: (() => {
      try {
        return row.Embeds ? [JSON.parse(row.Embeds)] : [];
      } catch {
        return [];
      }
    })(),
    channel: null,
    reactions: {
      likes_count: 0,
      recasts_count: 0,
      likes: [],
      recasts: []
    },
    replies: { count: 0 },
    mentioned_profiles: [],
    mentioned_profiles_ranges: [],
    mentioned_channels: [],
    mentioned_channels_ranges: [],
    author_channel_context: undefined
  };
}


export const getCastsByParent = async (parentHash: string, limit = 20, offset = 0) => {
  const result = await query(
    `SELECT * 
     FROM casts 
     WHERE parent_hash = $1 
     ORDER BY timestamp DESC 
     LIMIT $2 OFFSET $3`,
    [parentHash, limit, offset]
  );
  return result.rows;
};

export const getCastByHashAndFid = async (hash: string, fid: number) => {
  console.log("here in db call")
  const result = await query(
    `SELECT * FROM farcaster_casts fc WHERE fc."Hash" = '${hash}' AND fc."Fid" = ${fid};`
  );
  // console.log(result)
  const finalResult = mapCastRow(result.rows[0]);
  console.log("final", finalResult);
  return finalResult;
};
