# Gemini API Key HTTP Referrer Configuration

## Production Error
```
Error: API_KEY_HTTP_REFERRER_BLOCKED
Requests from referer https://sanctuary-health-chef.web.app/ are blocked.
```

## Solution

The Gemini API key needs to have the production domain added to its HTTP referrer restrictions.

### Steps to Fix

1. **Go to Google Cloud Console:**
   - https://console.cloud.google.com/apis/credentials

2. **Find your Gemini API key:**
   - Look for the key that matches `VITE_GEMINI_API_KEY` in your GitHub secrets

3. **Edit the API key:**
   - Click on the key name to edit it

4. **Configure Application restrictions:**
   - Under "Application restrictions", select: **"HTTP referrers (web sites)"**

5. **Add Website restrictions:**
   Add these referrers (one per line):
   ```
   https://sanctuary-health-chef.web.app/*
   https://sanctuary-health-chef.web.app
   http://localhost:5177/*
   http://localhost:5177
   ```

6. **Optional - Add other app domains if using same key:**
   ```
   https://sanctuary-health.web.app/*
   https://sanctuary-health-trainer.web.app/*
   ```

7. **Save the changes**

### Important Notes

- The `/*` wildcard allows all paths under that domain
- The exact domain (without `/*`) is also needed for root-level requests
- Changes take effect immediately (no propagation delay)
- After updating, test the production app to verify the error is resolved

### Verification

After updating the API key restrictions:
1. Wait 1-2 minutes for changes to propagate
2. Test the production app: https://sanctuary-health-chef.web.app
3. Try generating a recipe to verify Gemini API calls work
4. Check browser console for any remaining API errors

