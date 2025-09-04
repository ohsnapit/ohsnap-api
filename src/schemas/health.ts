import { t } from 'elysia';

export const healthResponseSchema = {
  200: t.Object({
    status: t.String({
      description: 'Current status of the API server',
      example: 'ok'
    }),
    timestamp: t.String({
      description: 'ISO timestamp of the server time',
      example: '2025-09-05T12:34:56.789Z'
    })
  })
};
