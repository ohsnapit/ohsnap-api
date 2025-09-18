import './instrument.js';
import { Elysia } from 'elysia';
import { openapi } from '@elysiajs/openapi';
import { staticPlugin } from '@elysiajs/static';
import { API_PORT } from './utils/constants.js';
import { openApiConfig } from './config/openapi.js';

// Import modular routes
import { castRoutes } from './routes/cast.js';
import { userRoutes } from './routes/user.js';
import { reactionRoutes } from './routes/reactions.js';
import { onchainRoutes } from './routes/onchain.js';
import { linkRoutes } from './routes/links.js';
import { verificationRoutes } from './routes/verifications.js';
import { healthRoutes } from './routes/health.js';

const app = new Elysia()
  .use(openapi(openApiConfig))
  // Use modular routes
  .use(castRoutes)
  .use(userRoutes)
  .use(reactionRoutes)
  .use(onchainRoutes)
  .use(linkRoutes)
  .use(verificationRoutes)
  .use(healthRoutes);

// Start server
const port = process.env.PORT || API_PORT;
app.listen(port);
console.log(`🦊 Elysia is running at ${app.server?.hostname}:${app.server?.port}`);

export default app;