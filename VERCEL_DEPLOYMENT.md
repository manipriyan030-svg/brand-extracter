# Vercel Deployment Guide for Brand Extractor

## Current Issue: 503 Service Unavailable

You're getting a 503 error because Chrome isn't installed in your Vercel deployment. This is a common issue with Puppeteer on serverless platforms.

## Quick Fix Options

### Option 1: Use Browserless.io (Recommended)

Browserless.io provides hosted Chrome instances. It's the easiest solution for Vercel.

1. Sign up at [browserless.io](https://browserless.io)
2. Get your API token
3. Add to Vercel environment variables:
   ```
   BROWSERLESS_TOKEN=your_token_here
   ```
4. The code will automatically use Browserless instead of local Chrome

### Option 2: Alternative Headless Browser

Switch to Playwright which has better Vercel support:

```bash
npm uninstall puppeteer
npm install playwright
```

Then update the API route to use Playwright instead of Puppeteer.

### Option 3: Manual Chrome Installation

If you want to stick with Puppeteer:

1. **Redeploy** - The new `vercel.json` and build script should install Chrome during build
2. **Check Vercel logs** - Look for Chrome installation messages during build
3. **Monitor function logs** - Check if Chrome launches successfully

## Environment Variables for Vercel

Add these to your Vercel project settings:

```
BROWSERLESS_TOKEN=your_browserless_token
# OR for manual Chrome:
PUPPETEER_EXECUTABLE_PATH=./node_modules/.puppeteer_cache/chrome/mac_arm-146.0.7680.153/chrome-mac-arm64/Google Chrome for Testing.app/Contents/MacOS/Google Chrome for Testing
```

## Testing Deployment

After deploying:

1. **Check build logs** in Vercel dashboard
2. **Test the API** with a simple request
3. **Monitor function logs** for Chrome-related errors

## Troubleshooting

### Build Fails
- Chrome download might timeout (176MB)
- Try reducing build time by pre-installing dependencies

### Runtime Fails
- Check if Chrome executable path exists
- Verify environment variables are set
- Look for "Could not find Chrome" in logs

### Alternative: Use Railway or Render

If Vercel continues to have issues, consider:
- **Railway** - Better for apps with system dependencies
- **Render** - Good Docker support
- **AWS Lambda** - More control over runtime

## Current Configuration

The `vercel.json` is configured with:
- 60 second timeout for API functions
- Node.js 18.x runtime
- Custom build command that installs Chrome

## Next Steps

1. **Choose an option above**
2. **Update your Vercel environment variables**
3. **Redeploy** your project
4. **Test** the API endpoint

The easiest path forward is **Option 1: Browserless.io** - it's designed exactly for this use case.