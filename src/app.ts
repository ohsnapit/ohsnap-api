import './instrument.js';
import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { API_PORT } from './utils/constants.js';
import { openApiConfig } from './config/openapi.js';
import { readFileSync } from 'fs';
import { join } from 'path';
import { castRoutes } from './routes/cast.js';
import { userRoutes } from './routes/user.js';
import { onChainRoutes } from './routes/onchain.js';
import { reactionRoutes } from './routes/reactions.js';
import { linkRoutes } from './routes/links.js';
import { verificationRoutes } from './routes/verifications.js';
import { healthRoutes } from './routes/health.js';

const app = new Elysia()
  .use(openapi(openApiConfig))
  .get('/favicon.ico', () => {
    const faviconPath = join(process.cwd(), 'public', 'favicon.ico');
    const favicon = readFileSync(faviconPath);
    return new Response(favicon, {
      headers: {
        'Content-Type': 'image/x-icon',
        'Cache-Control': 'public, max-age=31536000'
      }
    });
  })
  .use(castRoutes)
  .use(userRoutes)
  .use(onChainRoutes)
  .use(reactionRoutes)
  .use(linkRoutes)
  .use(verificationRoutes)
  .use(healthRoutes)

// Start server
const port = process.env.PORT || API_PORT;
app.listen(port);
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;
