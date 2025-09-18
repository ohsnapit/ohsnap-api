import { Elysia } from 'elysia';
import { healthResponseSchema } from '../schemas/health.js';

export const healthRoutes = new Elysia({ prefix: '/v1' })
  // Health check route
  .get('/health', async () => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }, {
    response: healthResponseSchema,
    detail: {
      tags: ['Health'],
      summary: 'Health check',
      description: 'Simple health check endpoint to verify API is running'
    }
  });
