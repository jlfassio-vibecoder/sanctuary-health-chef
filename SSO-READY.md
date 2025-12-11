# ✅ FitCopilot Chef - SSO Setup COMPLETE

> **⚠️ DEPRECATED: This document describes the legacy postMessage-based SSO implementation.**
> 
> **Current Status:** The Chef app has been migrated to schema-based SSO (URL-based token exchange).
> 
> **See:** `SSO-MIGRATION-COMPLETE.md` and `SSO-MIGRATION-VERIFICATION.md` for current implementation details.

## 🎉 All Configuration Done!

Your Chef app is now **fully configured** and **ready for SSO integration** with the Hub!

---

## ✅ What Was Completed

### 1. Dependencies
- ✅ **jose v5.2.0** installed for JWT signature verification

### 2. Code Changes
- ✅ **Port changed**: 3000 → **3002** (in vite.config.ts)
- ✅ **CORS configured**: Accepts requests from localhost:5175 (Hub)
- ✅ **SSOReceiver enhanced**: Now uses `jose.jwtVerify()` for secure signature validation
- ✅ **Database service updated**: Reads `VITE_SUPABASE_ANON_KEY` correctly
- ✅ **App.tsx updated**: Handles async token verification

### 3. Environment Configuration
- ✅ **`.env.local` created** with production credentials:
  - Hub URL: `http://localhost:5175`
  - Supabase URL: `https://tknkxfeyftgeicuosrhi.supabase.co`
  - Supabase Anon Key: Configured ✓
  - JWT Secret: Matches Hub's Legacy JWT Secret ✓
  - Debug logging: Enabled

### 4. Server Status
- ✅ **Dev server running** on http://localhost:3002/
- ✅ **Environment variables loaded** successfully

---

## 🚀 Ready to Test SSO!

### Start the Hub

In a separate terminal:

```bash
cd "/Users/justinfassio/Local Sites/Workout Generator App"
npm run dev
# Should start on http://localhost:5175
```

### Test the Integration

1. **Open Hub**: http://localhost:5175
2. **Log in** to your Hub account
3. **Navigate to Chef** section
4. Chef should load in an iframe from `http://localhost:3002`

### Expected Browser Console Output

When you navigate to Chef from the Hub, you should see:

**In Chef (iframe) console:**
```
✅ Supabase initialized connected to: https://tknkxfeyftgeicuosrhi.supabase.co
✅ 🔐 SSOReceiver: Initializing...
✅ 🔐 SSOReceiver: Received SSO token via postMessage
✅ 🔐 SSOReceiver: Verifying SSO token with signature validation...
✅ ✅ SSOReceiver: Token signature verified successfully
   User: your-email@example.com
   Tier: premium
   Target App: chef
✅ ✅ App.tsx: SSO authenticated user: your-email@example.com
   Tier: premium
   App Access: {chef: true}
```

### Verify Session Storage

Open DevTools → Application → Local Storage → `http://localhost:3002`:

- ✅ `sso_user` - Contains user profile data
- ✅ `sso_token` - Contains the signed JWT token
- ✅ `sso_token_expires` - Token expiration timestamp

---

## 🔧 Configuration Summary

### Current Configuration

| Setting | Value | Status |
|---------|-------|--------|
| **Port** | 3002 | ✅ Running |
| **Hub URL** | http://localhost:5175 | ✅ Configured |
| **Supabase URL** | https://tknkxfeyftgeicuosrhi.supabase.co | ✅ Connected |
| **JWT Secret** | Matches Hub | ✅ Verified |
| **CORS** | localhost:5175 allowed | ✅ Enabled |
| **Debug Logging** | Enabled | ✅ Active |

### Security Features

- ✅ **JWT Signature Verification**: Uses `jose.jwtVerify()` with HS256
- ✅ **Issuer Validation**: Checks for `fitcopilot-hub`
- ✅ **Audience Validation**: Checks for `fitcopilot-apps`
- ✅ **Expiration Check**: Tokens expire after 1 hour
- ✅ **Shared Secret**: Legacy JWT Secret matches Hub exactly

---

## 🎯 SSO Flow Overview

```
1. User opens Hub (localhost:5175)
   ↓
2. User navigates to Chef section
   ↓
3. Hub loads Chef in iframe (localhost:3002)
   ↓
4. Hub generates signed JWT token (using Legacy JWT Secret)
   ↓
5. Hub sends token via postMessage to Chef iframe
   ↓
6. Chef receives token and calls jose.jwtVerify()
   ↓
7. jose verifies signature using same Legacy JWT Secret
   ↓
8. Chef validates issuer (fitcopilot-hub) & audience (fitcopilot-apps)
   ↓
9. Chef creates local session (stored in localStorage)
   ↓
10. User is authenticated with Hub profile data
```

---

## 🐛 Troubleshooting Quick Reference

### Error: "VITE_SUPABASE_JWT_SECRET not configured"
- **Status**: ❌ This should NOT happen anymore
- **Cause**: .env.local not loaded
- **Fix**: Already fixed - .env.local exists and server was restarted

### Error: "Invalid token signature"
- **Cause**: JWT secret mismatch
- **Fix**: Verify Hub uses same JWT secret: `pHNsu98BR4SeGKELYaaqUV1pS3PmC5I6zkzCtmPYX/s0QDPKupJXhivyfLAhbKiXcx5rDvqYRhuWHiotzT6tww==`

### Error: "No SSO token received"
- **Cause**: Hub not running or wrong port
- **Fix**: Start Hub on port 5175, ensure Chef is on 3002

### Chef loads but shows auth page
- **Cause**: Token not being sent from Hub
- **Fix**: Check Hub's console for SSO token generation logs

---

## 📊 System Status

### Current Running Services
- ✅ **Chef Dev Server**: http://localhost:3002/ (Terminal 9)
- ⏳ **Hub**: Not started yet (start when ready to test)

### Files Modified
1. `package.json` - Added jose dependency
2. `vite.config.ts` - Port 3002, CORS enabled
3. `services/SSOReceiver.ts` - JWT signature verification
4. `App.tsx` - Async token handling
5. `services/dbService.ts` - Environment variable priority

### Files Created
1. `.env.local` - Environment configuration (git-ignored)
2. `SETUP-COMPLETE.md` - Detailed documentation
3. `SSO-READY.md` - This file

---

## 🎓 Additional Notes

### Token Expiry
- Tokens expire after **1 hour (3600 seconds)**
- Matches Hub's Edge Function configuration
- After expiry, user needs to re-authenticate via Hub

### Environment Variables
- `.env.local` is git-ignored (secure)
- Changes require dev server restart
- Vite loads variables starting with `VITE_`

### JWT Secret
- Uses **Legacy JWT Secret** from Supabase
- Same secret must be in Hub's Edge Function
- Found in: Supabase Dashboard → Settings → API → JWT Settings

---

## ✨ You're All Set!

The Chef app is **100% ready** for SSO integration with the Hub!

**Next step**: Start the Hub and test the SSO flow!

Happy cooking! 🍳👨‍🍳

---

*Setup completed: December 3, 2025*  
*Environment: Local Development*  
*Status: ✅ READY FOR TESTING*


