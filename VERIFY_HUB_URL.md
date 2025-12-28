# How to Verify the Correct Hub URL

## Question
Is `https://sanctuary-health.web.app` the Hub app, or does it redirect to the Trainer app?

## How to Check

### Option 1: Check Firebase Hosting Sites
1. Go to: https://console.firebase.google.com/project/sanctuary-health/hosting
2. Look at the list of sites:
   - `sanctuary-health` (or similar) = Hub app
   - `sanctuary-health-trainer` = Trainer app  
   - `sanctuary-health-chef` = Chef app

### Option 2: Test the URL Directly
1. Open: `https://sanctuary-health.web.app` in a browser
2. Check what loads:
   - If it's the Hub (main app with navigation to Trainer/Chef) → This is correct
   - If it redirects to Trainer → Wrong URL, need to find the actual Hub URL

### Option 3: Check Trainer App Configuration
If the Trainer app has `VITE_HUB_URL` set, check what value it uses - that's the correct Hub URL.

## Expected URLs
Based on the codebase:
- **Hub:** `https://sanctuary-health.web.app` (or similar)
- **Trainer:** `https://sanctuary-health-trainer.web.app`
- **Chef:** `https://sanctuary-health-chef.web.app`

## If `https://sanctuary-health.web.app` is NOT the Hub

You need to find the actual Hub production URL and update:
1. GitHub secret `VITE_HUB_URL` to the correct Hub URL
2. Trigger a new deployment

The Hub URL should be the app that:
- Has the `/api/exchange-firebase-sso-token` endpoint
- Generates SSO tokens for Trainer and Chef apps
- Is the main navigation app
