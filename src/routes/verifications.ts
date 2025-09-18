import { Elysia } from 'elysia';
import { getVerificationsByFid } from '../services/http.js';
import { startTimer, logServiceMethod, logError } from '../utils/logger.js';
import { withSpan, addBreadcrumb } from '../utils/tracing.js';
import { 
  verificationsByFidQuerySchema, 
  verificationsByFidResponseSchema, 
  verificationsByFidExamples 
} from '../schemas/verifications.js';

export const verificationRoutes = new Elysia({ prefix: '/v1' })
  // Verifications by FID route
  .get('/verificationsByFid', async ({ query }) => {
    return withSpan(
      'GET /v1/verificationsByFid',
      'http.server',
      async () => {
        logServiceMethod('api', 'getVerificationsByFid', { query });
        addBreadcrumb('API request: GET /v1/verificationsByFid', 'api', 'info', { query });
        
        try {
          const { fid, pageSize, pageToken, reverse } = query;

          if (!fid) {
            return { error: 'fid parameter is required' };
          }

          const fidNumber = parseInt(fid as string);
          const pageSizeNumber = pageSize ? parseInt(pageSize as string) : 1000;
          const reverseFlag = reverse === 'true';

          if (isNaN(fidNumber)) {
            return { error: 'fid must be a valid number' };
          }

          if (pageSize && (isNaN(pageSizeNumber) || pageSizeNumber < 1)) {
            return { error: 'pageSize must be a valid positive number' };
          }

          const result = await getVerificationsByFid(
            fidNumber,
            pageSizeNumber,
            pageToken as string,
            reverseFlag
          );
          
          return result;
        } catch (error: any) {
          logError(error, 'api_getVerificationsByFid', { 
            fid: query.fid, 
            pageSize: query.pageSize,
            pageToken: query.pageToken,
            reverse: query.reverse
          });
          return { error: 'Internal server error', details: error.message };
        }
      },
      { endpoint: '/v1/verificationsByFid', query }
    );
  }, {
    query: verificationsByFidQuerySchema,
    response: verificationsByFidResponseSchema,
    detail: {
      tags: ['Verifications'],
      summary: 'Get all verifications by an FID',
      description: `Get all verifications by an FID with pagination support.

**Parameters:**
- **fid** (required): The FID of the verification's creator
- **pageSize** (optional): Page size, defaults to 1000
- **pageToken** (optional): Pagination token for next page
- **reverse** (optional): Reverse order flag (true/false)

**Response Format:**
- Contains a "messages" array with detailed verification information
- Each message includes data, hash, signature, and signer information
- Verification body contains address and other verification details
- Pagination support with nextPageToken

**Usage:**
- Get all verifications: Just provide fid
- Paginated: Use pageToken for loading more results`,
      examples: verificationsByFidExamples
    }
  });
