# How to Find the Correct Gemini API Key

Since you created the key in AI Studio and added it to GitHub secrets, you need to match it with the key in Google Cloud Console.

## Step-by-Step Process

### Step 1: Get the Key Value from GitHub

1. Go to: https://github.com/jlfassio-vibecoder/sanctuary-health-chef/settings/secrets/actions
2. Click on `VITE_GEMINI_API_KEY`
3. Click "Update" (you won't be able to see the full value, but you can copy it)
4. Copy the entire key value (starts with `AIzaSy...`)

### Step 2: Find the Matching Key in Google Cloud Console

1. Go to: https://console.cloud.google.com/apis/credentials
2. For each API key listed:
   - Click on the key name
   - Click "Show key" or "Reveal key" button
   - Compare the key value with what you copied from GitHub
   - **The matching key is the one to update**

### Step 3: Alternative - Check All Keys

If you can't reveal the keys, check both:

1. **"Browser key (auto created by Firebase)"**
   - Click to edit
   - Check "API restrictions" → See which APIs are enabled
   - If "Generative Language API" is enabled → This might be it
   - Check "Application restrictions" → See HTTP referrers

2. **"Sanctuary Health"**
   - Click to edit
   - Check "API restrictions" → See which APIs are enabled
   - If "Generative Language API" is enabled → This might be it
   - Check "Application restrictions" → See HTTP referrers

### Step 4: Update the Correct Key

Once you identify the correct key:

1. Under "Application restrictions" → Select "HTTP referrers (web sites)"
2. Under "Website restrictions" → Click "Add an item"
3. Add these referrers:
   ```
   https://sanctuary-health-chef.web.app/*
   https://sanctuary-health-chef.web.app
   http://localhost:5177/*
   http://localhost:5177
   ```
4. Click "Save"

## Quick Test

After updating, the production error should be resolved. The 403 error with "API_KEY_HTTP_REFERRER_BLOCKED" should disappear.

