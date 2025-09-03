import type { HttpResponse } from '../types/http.js';

/**
 * Helper function to get complete paginated total count - gets ALL pages until the very end
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

  // Keep going until there are absolutely no more pages
  while (hasMore) {
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

      // Progress logging for very large datasets
      if (pageCount % 100 === 0) {
        console.log(`Paginated ${totalCount.toLocaleString()} items so far (${pageCount} pages) for ${endpoint}`);
      }
    } catch (error) {
      console.error(`Failed to get page ${pageCount} for ${endpoint}:`, error);
      break;
    }
  }

  console.log(`Completed pagination: ${totalCount.toLocaleString()} total items (${pageCount} pages) for ${endpoint}`);
  return totalCount;
}