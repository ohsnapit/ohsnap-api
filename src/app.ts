import { Elysia } from 'elysia';
import { getCastByFidAndHash } from './services/cast.js';
import { API_PORT } from './utils/constants.js';

const app = new Elysia()
  .get('/v1/cast', async ({ query }) => {
    try {
      const { fid, hash } = query;
      
      if (!fid || !hash) {
        return { error: 'fid and hash parameters are required' };
      }

      const fidNumber = parseInt(fid as string);
      const hashString = hash as string;

      if (isNaN(fidNumber)) {
        return { error: 'fid must be a valid number' };
      }

      if (!hashString.startsWith('0x') || hashString.length !== 42) {
        return { error: 'hash must be a valid hex string starting with 0x' };
      }

      // Get cast with all enrichments
      const response = await getCastByFidAndHash(fidNumber, hashString);
      return response;

    } catch (error: any) {
      console.error('Error fetching cast:', error);
      return { 
        error: 'Internal server error',
        details: error.message 
      };
    }
  })
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .listen(API_PORT);

console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;