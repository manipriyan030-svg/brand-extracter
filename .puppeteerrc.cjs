const path = require('path');

module.exports = {
  // Set cache directory to node_modules to make it portable
  cacheDirectory: process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), 'node_modules', '.puppeteer_cache'),
  
  // Use Chrome (not Chromium) for better compatibility
  chrome: {
    skipDownload: false,
  },
  
  // Optional: use fallback mirrors if primary download fails
  downloadHost: process.env.PUPPETEER_DOWNLOAD_HOST || 'https://googlechromelabs.github.io/chrome-for-testing',
  
  // Disable beta versions
  skipChromeDownload: false,
};
