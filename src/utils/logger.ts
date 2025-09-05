import { Sentry } from '../instrument.js';
import { addBreadcrumb } from './tracing.js';

/**
 * Performance timing utility with Sentry span integration
 */
export class PerformanceTimer {
  private startTime: number;
  private name: string;
  private attributes: Record<string, any>;
  private span?: any;

  constructor(name: string, attributes: Record<string, any> = {}) {
    this.name = name;
    this.attributes = attributes;
    this.startTime = Date.now();
    
    // Create a Sentry span for this operation
    this.span = Sentry.startSpan(
      {
        name: this.name,
        op: 'function',
        attributes: this.attributes,
      },
      (span) => {
        addBreadcrumb(`${this.name} started`, 'performance', 'info', this.attributes);
        return span;
      }
    );
  }

  end(additionalAttributes: Record<string, any> = {}) {
    const duration = Date.now() - this.startTime;
    const allAttributes = { ...this.attributes, ...additionalAttributes, duration };
    
    // Update span with final data
    if (this.span) {
      this.span.setAttribute('duration', duration);
      this.span.setAttribute('success', !additionalAttributes.error);
      if (additionalAttributes.error) {
        this.span.setStatus({ code: 2, message: 'internal_error' });
        this.span.setAttribute('error', additionalAttributes.error);
      } else {
        this.span.setStatus({ code: 1, message: 'ok' });
      }
      Object.entries(additionalAttributes).forEach(([key, value]) => {
        this.span?.setAttribute(key, value);
      });
    }
    
    Sentry.logger.info(`${this.name} completed`, allAttributes);
    
    // Also log performance as a metric
    if (duration > 1000) {
      Sentry.logger.warn(`${this.name} took ${duration}ms`, allAttributes);
    }
    
    addBreadcrumb(`${this.name} completed`, 'performance', 'info', allAttributes);
    
    return duration;
  }
}

/**
 * Start performance timer
 */
export function startTimer(name: string, attributes: Record<string, any> = {}): PerformanceTimer {
  return new PerformanceTimer(name, attributes);
}

/**
 * Log HTTP request
 */
export function logHttpRequest(method: string, url: string, attributes: Record<string, any> = {}) {
  Sentry.logger.debug('HTTP request started', {
    method,
    url,
    ...attributes
  });
}

/**
 * Log HTTP response
 */
export function logHttpResponse(method: string, url: string, statusCode: number, duration: number, attributes: Record<string, any> = {}) {
  const level = statusCode >= 400 ? 'error' : statusCode >= 300 ? 'warn' : 'info';
  
  Sentry.logger[level]('HTTP request completed', {
    method,
    url,
    statusCode,
    duration,
    ...attributes
  });
}

/**
 * Log external API call
 */
export function logExternalApiCall(apiName: string, endpoint: string, attributes: Record<string, any> = {}) {
  Sentry.logger.info('External API call', {
    apiName,
    endpoint,
    ...attributes
  });
}

/**
 * Log transformation operation
 */
export function logTransformation(operation: string, inputSize: number, outputSize?: number, attributes: Record<string, any> = {}) {
  Sentry.logger.debug('Transformation completed', {
    operation,
    inputSize,
    outputSize,
    ...attributes
  });
}

/**
 * Log error with context
 */
export function logError(error: Error, context: string, attributes: Record<string, any> = {}) {
  Sentry.logger.error(`Error in ${context}`, {
    error: error.message,
    stack: error.stack,
    ...attributes
  });
}

/**
 * Log service method entry/exit
 */
export function logServiceMethod(serviceName: string, methodName: string, attributes: Record<string, any> = {}) {
  const logData = {
    service: serviceName,
    method: methodName,
    ...attributes,
    timestamp: new Date().toISOString()
  };
  
  Sentry.logger.info(`${serviceName}.${methodName} called`, logData);
}