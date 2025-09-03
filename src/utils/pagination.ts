import type { HttpResponse } from '../types/http.js';

/**
 * Helper function to get complete paginated total count - gets up to 100K items (100 pages max) with timeout
 */
export async function getPaginatedCount(
  httpRequest: <T>(endpoint: string, params: Record<string, string | number | boolean>) => Promise<T>,
  endpoint: string, 
  params: Record<string, string | number>
): Promise<number> {
  let totalCount = 0;
  let pageToken: string | undefined;
  let hasMore = true;
  let pageCount = 0;
  const maxPages = 100; // Limit to 100K items max (100 pages * 1000 per page)
  const startTime = Date.now();
  const maxTimeMs = 30000; // 30 second timeout

  // Keep going until we hit limits
  while (hasMore && pageCount < maxPages) {
    try {
      // Check timeout
      if (Date.now() - startTime > maxTimeMs) {
        break;
      }

      const requestParams = {
        ...params,
        pageSize: 1000,
        ...(pageToken && { pageToken })
      };

      const response = await httpRequest<HttpResponse<any>>(endpoint, requestParams);
      
      if (response.messages && response.messages.length > 0) {
        totalCount += response.messages.length;
      }

      // Check if there's more data
      pageToken = response.nextPageToken;
      hasMore = !!pageToken;
      pageCount++;

      // If we got less than pageSize, we're at the end
      if (!response.messages || response.messages.length < 1000) {
        hasMore = false;
      }

    } catch (error) {
      console.error(`Failed to get page ${pageCount} for ${endpoint}:`, error);
      break;
    }
  }

  return totalCount;
}