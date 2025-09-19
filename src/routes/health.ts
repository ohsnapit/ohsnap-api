import Elysia from "elysia";
import { healthResponseSchema } from "../schemas/health";

export const healthRoutes = new Elysia()
    // Health route
    .get('/health', () => ({ status: 'ok', timestamp: new Date().toISOString() }), {
        response: healthResponseSchema,
        detail: {
            tags: ['Health'],
            summary: 'Health check',
            description: 'Returns the current status and timestamp of the API server'
        }
    });