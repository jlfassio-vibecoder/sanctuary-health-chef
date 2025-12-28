# Production Issues Fix Guide

## Issue 1: SSO Hub URL (CORS Error)

**Error:**
```
Access to fetch at 'http://localhost:5175/api/exchange-firebase-sso-token' 
from origin 'https://sanctuary-health-chef.web.app' has been blocked by CORS
```

**Problem:** Production app is using `http://localhost:5175` instead of production Hub URL.

**Fix:**
1. Go to: https://github.com/jlfassio-vibecoder/sanctuary-health-chef/settings/secrets/actions
2. Find `VITE_HUB_URL` secret
3. Update it to: `https://sanctuary-health.web.app` (NOT `http://localhost:5175`)
4. After updating, trigger a new deployment

## Issue 2: Gemini API 403 Error

**Error:**
```
API_KEY_HTTP_REFERRER_BLOCKED
Requests from referer https://sanctuary-health-chef.web.app/ are blocked.
```

**Problem:** HTTP referrer restrictions on the Browser key don't include production domain.

**Fix:**
1. Go to: https://console.cloud.google.com/apis/credentials
2. Click "Browser key (auto created by Firebase)"
3. Under "Application restrictions" → Ensure "HTTP referrers (web sites)" is selected
4. Under "Website restrictions" → Add:
   ```
   https://sanctuary-health-chef.web.app/*
   https://sanctuary-health-chef.web.app
   http://localhost:5177/*
   http://localhost:5177
   ```
5. Click "Save"

**Note:** Changes take effect immediately. No deployment needed for API key changes.
