import { Sentry } from '../instrument.js';

/**
 * Create a Sentry span for tracking operations
 */
export function createSpan(
  operation: string,
  description?: string,
  data?: Record<string, any>
): ReturnType<typeof Sentry.startSpan> {
  return Sentry.startSpan(
    {
      name: operation,
      op: operation,
      attributes: data,
    },
    (span) => {
      return span;
    }
  );
}

/**
 * Execute a function within a Sentry span with proper operation categorization
 */
export async function withSpan<T>(
  name: string,
  operation: string,
  fn: () => Promise<T>,
  data?: Record<string, any>
): Promise<T> {
  return Sentry.startSpan(
    {
      name: name,
      op: operation,
      attributes: data,
    },
    async (span) => {
      try {
        const result = await fn();
        span.setStatus({ code: 1, message: 'ok' });
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: 'internal_error' });
        span.setAttribute('error', error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );
}

/**
 * Execute a synchronous function within a Sentry span with proper operation categorization
 */
export function withSpanSync<T>(
  name: string,
  operation: string,
  fn: () => T,
  data?: Record<string, any>
): T {
  return Sentry.startSpan(
    {
      name: name,
      op: operation,
      attributes: data,
    },
    (span) => {
      try {
        const result = fn();
        span.setStatus({ code: 1, message: 'ok' });
        return result;
      } catch (error) {
        span.setStatus({ code: 2, message: 'internal_error' });
        span.setAttribute('error', error instanceof Error ? error.message : String(error));
        throw error;
      }
    }
  );
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(
  message: string,
  category: string,
  level: 'debug' | 'info' | 'warning' | 'error' = 'info',
  data?: Record<string, any>
): void {
  Sentry.addBreadcrumb({
    message,
    category,
    level,
    data,
    timestamp: Date.now() / 1000,
  });
}

/**
 * Set user context for better debugging
 */
export function setUserContext(user: { id?: string; username?: string; fid?: number }): void {
  Sentry.setUser({
    id: user.id,
    username: user.username,
    extra: {
      fid: user.fid,
    },
  });
}

/**
 * Set custom tags for filtering and grouping
 */
export function setTags(tags: Record<string, string | number | boolean>): void {
  Sentry.setTags(tags);
}

/**
 * Set custom context data
 */
export function setContext(key: string, context: Record<string, any>): void {
  Sentry.setContext(key, context);
}

/**
 * Capture an exception with context
 */
export function captureException(
  error: Error,
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
    level?: 'fatal' | 'error' | 'warning' | 'info' | 'debug';
  }
): void {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  if (context?.extra) {
    Sentry.setExtra('context', context.extra);
  }

  Sentry.captureException(error, {
    level: context?.level || 'error',
  });
}

/**
 * Capture a message with context
 */
export function captureMessage(
  message: string,
  level: 'fatal' | 'error' | 'warning' | 'info' | 'debug' = 'info',
  context?: {
    tags?: Record<string, string | number | boolean>;
    extra?: Record<string, any>;
  }
): void {
  if (context?.tags) {
    Sentry.setTags(context.tags);
  }
  
  if (context?.extra) {
    Sentry.setExtra('context', context.extra);
  }

  Sentry.captureMessage(message, level);
}
