import { Elysia, t } from 'elysia';
import { logError } from '../utils/logger.js';

export const apiKeyAuth = (app: Elysia) =>
  app.onRequest(async ({ request, set, headers }) => {
    const apiKey = headers['x-api-key'] || headers['X-API-Key'];
    
    if (!apiKey) {
      set.status = 401;
      logError('API key is required', 'api_key_auth', { path: request.url });
      return { error: 'API key is required. Please provide an X-API-Key header.' };
    }

    // Validate the API key (you should replace this with your actual validation logic)
    const isValid = await validateApiKey(apiKey);
    
    if (!isValid) {
      set.status = 403;
      logError('Invalid API key', 'api_key_auth', { path: request.url });
      return { error: 'Invalid API key' };
    }
  });

// Replace this with your actual API key validation logic
async function validateApiKey(apiKey: string): Promise<boolean> {
  // In a real application, you would:
  // 1. Check the key against your database
  // 2. Validate the key's permissions, rate limits, etc.
  // 3. Return true if valid, false otherwise
  // For now, we'll just check if it's not empty
  return !!apiKey;
}

// Type for the API key configuration
export const apiKeyConfig = {
  security: [{ apiKey: [] }],
  detail: {
    security: [{ apiKey: [] }]
  }
} as const;
