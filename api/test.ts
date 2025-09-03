import { Elysia } from 'elysia';

const app = new Elysia()
  .get('/', () => 'Hello from OhSnap API!')
  .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }))
  .get('/test', () => ({ message: 'Test endpoint working', time: new Date().toISOString() }));

// Export for Vercel
export default app.fetch;
