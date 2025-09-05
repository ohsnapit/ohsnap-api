// Import Bun's Sentry SDK
const Sentry = await import("@sentry/bun");

// Initialize Sentry as early as possible
Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV || "development",
  
  // Enable structured logging
  enableLogs: true,
  
  // Performance monitoring with proper tracing
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.1 : 1.0,
  
  // Enable console logging integration
  integrations: [
    // Use Bun's console logging integration
    Sentry.consoleLoggingIntegration({ 
      levels: ["debug", "info", "warn", "error"] 
    }),
    // Add HTTP integration for better request tracing
    Sentry.httpIntegration({
      breadcrumbs: true,
    }),
  ],

  // Send default PII for better debugging
  sendDefaultPii: true,

  // Set trace propagation targets for distributed tracing
  tracePropagationTargets: [
    "localhost",
    /^https:\/\/.*\.sentry\.io/,
    "https://ohsnap-api-production.up.railway.app",
  ],

  // Filter out noisy logs in production
  beforeSendLog: (log) => {
    if (process.env.NODE_ENV === "production" && log.level === "debug") {
      return null; // Filter debug logs in production
    }
    return log;
  },
});

export { Sentry };