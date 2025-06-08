module.exports = {
  // Critical CSS settings
  critical: {
    // List of paths to analyze
    paths: ['/login', '/'],
    // Maximum asset size to inline (in bytes)
    inlineThreshold: 4096,
    // Maximum image size to inline (in bytes)
    inlineImageThreshold: 2048,
    // CSS selector to identify which elements need critical CSS
    selectors: [
      '.login-container',
      '.dashboard-container',
      '.floating-logo',
      '.login-box',
      '.message',
      '.status',
      'body',
      'html'
    ],
    // Network idle timeout (in ms)
    networkIdleTimeout: 500,
    // Maximum critical CSS size (in bytes)
    maxCssLength: 20000,
  }
};
