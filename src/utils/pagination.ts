import type { HttpResponse } from '../types/http.js';

/**
 * Helper function to get paginated total count
 */
export async function getPaginatedCount(
  httpRequest: <T>(endpoint: string, params: Record<string, string | number | boolean>) => Promise<T>,
  endpoint: string, 
  params: Record<string, string | number>
): Promise<number> {
  let totalCount = 0;
  let pageToken: string | undefined;
  let hasMore = true;
  const maxPages = 10000;
  let pageCount = 0;

  while (hasMore && pageCount < maxPages) {
    try {
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

      // Safety check - if count gets extremely high, stop to prevent timeout
      if (totalCount > 1000000) {
        console.warn(`Count exceeded 1M for ${endpoint}, stopping pagination`);
        break;
      }
    } catch (error) {
      console.error(`Failed to get page ${pageCount} for ${endpoint}:`, error);
      break;
    }
  }

  return totalCount;
}