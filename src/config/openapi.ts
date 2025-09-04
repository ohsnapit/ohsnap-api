import { API_PORT, HTTP_IP } from '../utils/constants.js';

export const openApiConfig = {
  documentation: {
    info: {
      title: 'OhSnap API',
      version: '1.0.0',
      description: `Open source alternative to index the Farcaster snapchain. Compatible with Neynar API responses.
      
**Pagination Control**: Use fullCount=true parameter for complete accuracy or leave default for fast response with 10K limits.`,
      contact: {
        name: 'OhSnap API',
        url: 'https://github.com/ohsnapit/ohsnap-api'
      }
    },
    servers: [
      ...(process.env.NODE_ENV !== 'production' && !process.env.VERCEL ? [{
        url: `http://${HTTP_IP}:${API_PORT}`,
        description: 'Development server'
      }] : []),
      {
        url: 'https://ohsnap-api.vercel.app',
        description: 'Production server'
      }
    ],
    tags: [
      {
        name: 'Cast',
        description: 'Cast-related endpoints with optional pagination control. Use fullCount=true for complete accuracy.'
      },
      {
        name: 'User',
        description: 'User-related endpoints with optional pagination control. Use fullCount=true for complete accuracy.'
      },
      {
        name: 'Health',
        description: 'Health check endpoints'
      }
    ]
  },
  path: '/openapi'
};
