// Conditionally import the right Sentry SDK based on runtime
const Sentry = typeof Bun !== 'undefined' 
  ? await import("@sentry/bun")
  : await import("@sentry/node");

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
    // Use the appropriate console integration based on runtime
    typeof Bun !== 'undefined' 
    ? Sentry.consoleLoggingIntegration({ 
        levels: ["debug", "info", "warn", "error"] 
      })
    : Sentry.consoleIntegration({ 
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
    /^https:\/\/.*\.vercel\.app/,
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