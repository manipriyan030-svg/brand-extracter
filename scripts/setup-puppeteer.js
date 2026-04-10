#!/usr/bin/env node

/**
 * Setup script to ensure Chrome/Chromium is installed for Puppeteer
 * Runs as part of build and start processes
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const cacheDir = path.join(process.cwd(), 'node_modules', '.puppeteer_cache');

console.log(`🌐 Puppeteer setup: Checking Chrome installation...`);
console.log(`📁 Cache directory: ${cacheDir}`);

try {
  // Ensure cache directory exists
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
    console.log(`✅ Created cache directory`);
  }

  // Install Chrome
  console.log(`⏳ Installing Chrome (this may take a moment)...`);
  execSync('npx puppeteer browsers install chrome --with-fallback', {
    stdio: 'inherit',
    env: {
      ...process.env,
      PUPPETEER_CACHE_DIR: cacheDir,
    },
  });

  console.log(`✅ Chrome installation complete!`);
} catch (error) {
  console.error(`❌ Failed to install Chrome:`, error.message);
  console.error(`
⚠️  IMPORTANT: Chrome installation failed. This is required for Puppeteer.
   Try these steps manually:
   1. npx puppeteer browsers install chrome
   2. Ensure you have at least 150MB free disk space
   3. Check your internet connection

   Without Chrome, the brand extraction will not work.
  `);
  process.exit(1);
}
