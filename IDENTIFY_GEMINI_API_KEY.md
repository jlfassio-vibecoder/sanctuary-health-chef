# How to Identify Which Gemini API Key to Update

## Method 1: Check API Restrictions (Recommended)

1. **Click on "Browser key (auto created by Firebase)"**
   - Look at the "API restrictions" section
   - Check if "Generative Language API" or "Generative AI API" is listed
   - If YES → This is the key to update
   - If NO → Check the other key

2. **Click on "Sanctuary Health"**
   - Look at the "API restrictions" section
   - Check if "Generative Language API" or "Generative AI API" is listed
   - If YES → This is the key to update

## Method 2: Check the Key Value

1. **Get the key value from GitHub:**
   - Go to: https://github.com/jlfassio-vibecoder/sanctuary-health-chef/settings/secrets/actions
   - Click on `VITE_GEMINI_API_KEY` secret
   - Copy the first 10-15 characters (e.g., `AIzaSyB65txHQK`)

2. **Compare with Google Cloud Console:**
   - Click on each API key in Google Cloud Console
   - Look at the "Key" field (you may need to click "Show key" or "Reveal key")
   - Match the first characters with your GitHub secret
   - The matching key is the one to update

## Method 3: Check HTTP Referrer Restrictions

Since both keys have "HTTP referrers" restrictions, check which one currently has domains configured:

1. **Click on "Browser key (auto created by Firebase)"**
   - Look at "Website restrictions" under HTTP referrers
   - See what domains are currently listed

2. **Click on "Sanctuary Health"**
   - Look at "Website restrictions" under HTTP referrers
   - See what domains are currently listed

**The key that needs updating is the one that:**
- Has "Generative Language API" enabled, AND
- Does NOT have `https://sanctuary-health-chef.web.app/*` in its HTTP referrer list

## Quick Check

Most likely, the **"Sanctuary Health"** key is the one you need to update because:
- It was created Dec 21 (before the Chef app deployment)
- It's a custom-named key (not auto-created)
- The "Browser key" is auto-created by Firebase and might be for Firebase services only

**But verify by checking which one has "Generative Language API" enabled in API restrictions.**

