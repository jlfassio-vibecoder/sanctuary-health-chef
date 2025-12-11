# FitCopilot Chef - SSO Setup Complete ✅

> **⚠️ NOTE: This document references legacy postMessage-based SSO. The Chef app now uses schema-based SSO.**
> 
> **See:** `SSO-MIGRATION-COMPLETE.md` for current SSO implementation details.

## What Was Configured

### 1. Dependencies Installed
- ✅ **jose v5.2.0** - JWT signature verification library

### 2. Configuration Updates

#### Port Configuration
- ✅ Changed from port 3000 → **3002** (matches Hub expectations)
- ✅ Added CORS support for localhost:5175 (Hub)

#### Environment Variables Setup
- ⚠️ **ACTION REQUIRED**: You need to manually create `.env.local` with your Hub's credentials

**Create this file:** `/Users/justinfassio/Local Sites/Fitcopilot Chef/.env.local`

```bash
# FitCopilot Chef - Local Development Environment
VITE_HUB_URL=http://localhost:5175

# Supabase Configuration (MUST match Hub)
VITE_SUPABASE_URL=your_supabase_url_here
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key_here

# JWT Secret (CRITICAL - must match Hub)
VITE_SUPABASE_JWT_SECRET=your_jwt_secret_here

# Gemini API
GEMINI_API_KEY=your_gemini_api_key_here

# Optional Debug
VITE_DEBUG=true
VITE_LOG_LEVEL=debug
```

**Where to get these values:**
- `VITE_SUPABASE_URL`: From your Hub's .env file or Supabase Dashboard
- `VITE_SUPABASE_ANON_KEY`: From Supabase Dashboard → Settings → API → Project API keys
- `VITE_SUPABASE_JWT_SECRET`: From Supabase Dashboard → Settings → API → JWT Settings
- `GEMINI_API_KEY`: From Google AI Studio

### 3. SSO Receiver Enhanced

#### Security Improvements
- ✅ Replaced manual JWT decoding with **jose.jwtVerify()**
- ✅ Full signature verification using shared JWT secret
- ✅ Validates issuer (`fitcopilot-hub`) and audience (`fitcopilot-apps`)
- ✅ Comprehensive error messages for debugging

#### What Changed
- `verifyAndDecodeToken()` is now **async** (uses Promises)
- Added proper error codes for common issues:
  - `ERR_JWT_EXPIRED` - Token expired
  - `ERR_JWS_SIGNATURE_VERIFICATION_FAILED` - Wrong JWT secret
  - `ERR_JWT_CLAIM_VALIDATION_FAILED` - Issuer/audience mismatch

### 4. Database Service Updated
- ✅ Now prioritizes `VITE_SUPABASE_ANON_KEY` environment variable
- ✅ Maintains backwards compatibility with old variable names

## Current Status

### ✅ Running
The dev server is currently running at:
- **Local**: http://localhost:3002/
- **Network**: http://10.0.0.194:3002/

### ⏳ Next Steps

#### Before Testing SSO:

1. **Create .env.local** with your Hub's credentials (see template above)

2. **Restart the dev server** to load new environment variables:
   ```bash
   # Stop current server (Ctrl+C in the terminal)
   npm run dev
   ```

3. **Verify environment variables are loaded**:
   - Open http://localhost:3002/
   - Check browser console for SSO initialization logs
   - Should see: "🔐 SSOReceiver: Initializing..."

#### Testing SSO Flow:

1. **Start the Hub** on port 5175
   ```bash
   cd /path/to/fitcopilot-hub
   npm run dev
   ```

2. **Navigate to Chef from Hub**
   - Open http://localhost:5175
   - Click on the Chef section
   - Chef should load in an iframe

3. **Check Browser Console** (in Chef iframe):
   ```
   Expected logs:
   ✅ 🔐 SSOReceiver: Initializing...
   ✅ 🔐 SSOReceiver: Verifying SSO token with signature validation...
   ✅ ✅ SSOReceiver: Token signature verified successfully
   ✅    User: user@example.com
   ✅    Tier: premium
   ```

4. **Verify SSO Session**:
   - Open DevTools → Application → Local Storage
   - Should see: `sso_user`, `sso_token`, `sso_token_expires`
   - Should NOT redirect to auth page

## Troubleshooting

### "Invalid token signature"
**Cause**: JWT secret doesn't match between Hub and Chef  
**Fix**: Ensure `VITE_SUPABASE_JWT_SECRET` in Chef's `.env.local` exactly matches the Hub's JWT secret

### "No SSO token received"
**Causes**:
- Hub not running on port 5175
- Chef not running on port 3002
- Hub's `.env.local` doesn't have `VITE_EXTERNAL_CHEF_URL=http://localhost:3002`

**Fix**: Verify both apps are running on correct ports

### "VITE_SUPABASE_JWT_SECRET not configured"
**Cause**: .env.local not created or server not restarted  
**Fix**: 
1. Create `.env.local` with the JWT secret
2. Restart dev server (Ctrl+C then `npm run dev`)

### CORS Errors
**Cause**: Mixing localhost and 127.0.0.1  
**Fix**: Use `http://localhost:5175` for Hub and `http://localhost:3002` for Chef (not IP addresses)

## File Changes Summary

### Modified Files:
1. ✏️ `package.json` - Added jose dependency
2. ✏️ `vite.config.ts` - Changed port to 3002, added CORS
3. ✏️ `services/SSOReceiver.ts` - Added jose integration, enhanced security
4. ✏️ `App.tsx` - Updated to handle async token verification
5. ✏️ `services/dbService.ts` - Updated environment variable priority

### New Files Needed:
1. ⚠️ `.env.local` - **You must create this manually** (see template above)

## Quick Start Commands

```bash
# In Chef directory
npm run dev                    # Start on port 3002

# In Hub directory (separate terminal)
cd /path/to/fitcopilot-hub
npm run dev                    # Start on port 5175

# Then open browser
open http://localhost:5175     # Opens Hub, navigate to Chef from there
```

## Architecture Notes

### SSO Flow
1. User opens Hub (localhost:5175)
2. User navigates to Chef section
3. Hub loads Chef in iframe (localhost:3002)
4. Hub generates signed JWT token
5. Hub sends token via postMessage to Chef
6. Chef verifies JWT signature using shared secret
7. Chef creates local session (no Supabase auth)
8. User is authenticated with their Hub profile data

### Security
- JWT tokens are signed with HS256 algorithm
- Shared secret (VITE_SUPABASE_JWT_SECRET) validates authenticity
- Tokens include issuer/audience claims for additional validation
- Tokens have expiration time (typically 1 hour)

---

**Setup completed**: All code changes are done!  
**Action required**: Create `.env.local` and restart dev server  
**Status**: Ready for SSO testing with Hub


