import { Elysia, t } from 'elysia'
import { openapi } from '@elysiajs/openapi'
import { getCastByFidAndHash } from '../src/services/cast.js'

const app = new Elysia()
  .use(openapi({
    documentation: {
      info: {
        title: 'OhSnap API',
        version: '1.0.0',
        description: 'Open source alternative to index the Farcaster snapchain. Compatible with Neynar API responses.'
      },
      tags: [
        { name: 'Cast', description: 'Cast operations' },
        { name: 'Health', description: 'Health check operations' }
      ]
    }
  }))
  .get('/health', () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
    message: 'OhSnap API is working!'
  }), {
    detail: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Check if the API is running and get current timestamp'
    }
  })
  .get('/v1/cast', async ({ query }: { query: { fid: string, hash: string } }) => {
    const { fid, hash } = query
    
    if (!fid || !hash) {
      throw new Error('Both fid and hash parameters are required')
    }

    const fidNumber = parseInt(fid, 10);
    if (isNaN(fidNumber)) {
      throw new Error('fid must be a valid number');
    }

    if (!hash.startsWith('0x') || hash.length !== 42) {
      throw new Error('hash must be a valid hex string starting with 0x');
    }

    try {
      // Use the existing service to get cast data
      const castResponse = await getCastByFidAndHash(fidNumber, hash)
      return castResponse
    } catch (error: any) {
      throw new Error(`Failed to fetch cast: ${error.message}`)
    }
  }, {
    query: t.Object({
      fid: t.String({
        description: 'The FID (Farcaster ID) of the cast author'
      }),
      hash: t.String({
        description: 'The hash of the cast to fetch (must be a valid hex string starting with 0x)'
      })
    }),
    detail: {
      tags: ['Cast'],
      summary: 'Get cast by fid and hash',
      description: 'Fetch a Farcaster cast by its fid and hash. Returns enriched cast data compatible with Neynar API format.'
    }
  })

export default app