# Puppeteer Chrome Setup Guide

## Automatic Setup (Recommended)

Chrome will be automatically installed when you:
- Run `npm run dev` 
- Run `npm run build`
- Run `npm run start`

Or manually:
```bash
npm run setup:puppeteer
```

## What Happens

The setup script (`scripts/setup-puppeteer.js`):
1. Creates the cache directory: `node_modules/.puppeteer_cache`
2. Downloads Chrome v146.0.7680.153
3. Stores it in the cache for reuse
4. Provides clear error messages if something fails

## Manual Installation (If Needed)

If the automatic setup fails, run manually:
```bash
npx puppeteer browsers install chrome
```

Or with specific environment variables:
```bash
PUPPETEER_CACHE_DIR=./node_modules/.puppeteer_cache npx puppeteer browsers install chrome
```

## Troubleshooting

### "Could not find Chrome" Error

**Option 1:** Run the setup command
```bash
npm run setup:puppeteer
```

**Option 2:** Install Chrome manually
```bash
npx puppeteer browsers install chrome --with-fallback
```

**Option 3:** Check disk space
- Chrome requires ~150MB free disk space
- Run: `df -h` to check available space

**Option 4:** Clear cache and reinstall
```bash
rm -rf node_modules/.puppeteer_cache
npm run setup:puppeteer
```

### Cache Directory Issues

If you see errors about cache paths:
1. The config expects: `./node_modules/.puppeteer_cache`
2. This is set in `.puppeteerrc.cjs`
3. Verify the directory exists: `ls -la node_modules/.puppeteer_cache`

### Network Issues

If downloads fail:
```bash
# Try with a fallback mirror:
npx puppeteer browsers install chrome --with-fallback
```

## Environment Variables

These can override defaults:
- `PUPPETEER_CACHE_DIR` - Override cache location
- `PUPPETEER_DOWNLOAD_HOST` - Override download mirror

Example:
```bash
PUPPETEER_CACHE_DIR=/tmp/puppeteer npm run dev
```

## Production Deployment

Make sure your deployment runs one of these:
1. `npm install` (runs setup automatically)
2. `npm run dev` / `npm run build` / `npm run start` (all run setup)
3. `npm run setup:puppeteer` (explicitly)

All three will ensure Chrome is installed before your app starts.
