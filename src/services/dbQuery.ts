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

function mapReactionRow(row: any) {
  const [targetFid, targetHash] = row.TargetCastId ? row.TargetCastId.split(':') : [null, null];
  
  return {
    data: {
      type: row.MessageType,
      fid: Number(row.Fid),
      timestamp: Number(row.Timestamp), // Convert to Unix timestamp
      // network: 'FARCASTER_NETWORK_MAINNET',
      reactionBody: {
        type: row.ReactionType,
        ...(targetHash && targetFid ? {
          targetCastId: {
            fid: Number(targetFid),
            hash: targetHash
          }
        } : {}),
        ...(row.TargetUrl ? { targetUrl: row.TargetUrl } : {})
      }
    },
    hash: row.Hash,
    // hashScheme: 'HASH_SCHEME_BLAKE3',
    signature: row.Signature,
    signatureScheme: row.SignatureScheme || 'SIGNATURE_SCHEME_ED25519',
    signer: row.Signer
  };
}

function mapLinkRow(row: any) {
  return {
    data: {
      type: row.MessageType,
      fid: Number(row.Fid),
      timestamp: Number(row.Timestamp), // Convert to Unix timestamp
      // network: 'FARCASTER_NETWORK_MAINNET',
      linkBody: {
        type: row.LinkType,
        targetFid: Number(row.TargetFid)
      }
    },
    hash: row.Hash,
    // hashScheme: 'HASH_SCHEME_BLAKE3',
    signature: row.Signature,
    signatureScheme: row.SignatureScheme || 'SIGNATURE_SCHEME_ED25519',
    signer: row.Signer
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

export const getCastByHash = async (hash: string) => {
  console.log("here in db call")
  const result = await query(
    `SELECT * FROM farcaster_casts fc WHERE fc."Hash" = '${hash}';`
  );
  // console.log(result)
  const finalResult = mapCastRow(result.rows[0]);
  console.log("final", finalResult);
  return finalResult;
};


export const getReactionsByFid = async (fid: number, reactionType: string) => {
  const result = await query(
    `SELECT * FROM farcaster_reactions fr where fr."Fid" ='${fid}' and fr."ReactionType" ='${reactionType}'
    ORDER BY fr."Timestamp" DESC;`
  );
  return result.rows.map(mapReactionRow);
};

export const getReactionsByCast = async (targetFid: number, targetHash: string, reactionType: "Like" | "Recast") => {
  const result = await query(
    `SELECT * FROM farcaster_reactions fr where fr."TargetCastId" ='${targetFid}:${targetHash}' and fr."ReactionType" ='${reactionType}'
    ORDER BY fr."Timestamp" DESC;`
  );
  console.log("result", result.rows.map(mapReactionRow))
  return result.rows.map(mapReactionRow);
}

export const getLinksByFid = async (fid: number, linkType: string) => {
  const result = await query(
    `SELECT * FROM farcaster_links fl where fl."Fid" ='${fid}' and fl."LinkType" ='${linkType}'
    ORDER BY fl."Timestamp" DESC;`
  );
  console.log("result", result.rows.map(mapLinkRow))
  return result.rows.map(mapLinkRow);
}

export const getLinksByTargetFid = async (targetFid: number, linkType: string) => {
  const result = await query(
    `SELECT * FROM farcaster_links fl where fl."TargetFid" ='${targetFid}' and fl."LinkType" ='${linkType}'
    ORDER BY fl."Timestamp" DESC;`
  );
  console.log("result", result.rows.map(mapLinkRow))
  return result.rows.map(mapLinkRow);
}