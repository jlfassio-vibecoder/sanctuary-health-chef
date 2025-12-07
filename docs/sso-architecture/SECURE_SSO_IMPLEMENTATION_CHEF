Secure SSO Implementation for Chef (Token Receiver)
Overview
Replace the insecure client-side JWT verification with server-side validation using Supabase's auth API. This follows the unified SSO architecture where JWT secrets exist only in Edge Functions.

Current Issues
services/SSOReceiver.ts uses jose library for client-side JWT verification
Requires VITE_SUPABASE_JWT_SECRET in client code (security risk)
Exposes JWT secret in browser bundles
Unnecessary complexity with signature verification
Target Architecture
Initialize Supabase with anon key only
Receive SSO tokens via postMessage from Hub
Call supabase.auth.setSession() with access_token and refresh_token
Supabase validates tokens server-side (no client-side verification)
Custom JWT treated as metadata only
Implementation Steps
1. Copy Updated SSOReceiver.ts from Hub
Source: Hub's `src/services/hub/SSOReceiver.ts` (reference implementation)
Target: Chef's `services/SSOReceiver.ts`

This file has already been updated with:

✅ jose import and all JWT verification code REMOVED
✅ verifyAndDecodeToken() method REMOVED
✅ establishSupabaseSession() method ADDED
✅ initialize() updated to skip verification, directly establish session
✅ postMessage listener and origin validation KEPT
✅ sessionStorage management for SSO state KEPT
✅ Message handler simplified to extract tokens and call setSession
Key method to add:

async establishSupabaseSession(supabaseClient, tokenData) {
  const { data, error } = await supabaseClient.auth.setSession({
    access_token: tokenData.access_token,
    refresh_token: tokenData.refresh_token,
  });
  
  if (error) throw error;
  return data.session;
}
2. Update App.tsx Integration
File: App.tsx (lines 86-139)

Changes needed:

Remove the verifyAndDecodeToken() call (lines 96-101)
Directly call supabase.auth.setSession() when receiving SSO token
Simplify error handling
Update console logging to reflect new flow
Keep the dual auth pattern (SSO + standalone)
Key change (around line 92-136):

ssoReceiver.initialize(async (tokenData) => {
  console.log('🔐 Chef App: SSO token received');

  // CRITICAL: Establish Supabase session (server-side validation)
  if (tokenData.access_token && tokenData.refresh_token) {
    const { data, error } = await supabase.auth.setSession({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

    if (error) {
      console.error('❌ Failed to set Supabase session:', error);
      ssoReceiver.clearSSOData();
      return;
    }

    console.log('✅ Supabase session established:', data.user?.email);
    // Session picked up by auth state listener
  }
});
3. Update Environment Configuration
File: .env.example

Changes needed:

Remove VITE_SUPABASE_JWT_SECRET line
Add comment explaining why JWT secret is NOT needed
Keep VITE_HUB_URL for origin validation
Keep Supabase URL and anon key
New .env.example:

# Supabase Configuration (anon key only - JWT secret NOT needed!)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Hub URL for SSO origin validation (PRODUCTION)
VITE_HUB_URL=https://fitcopilot.app

# For local development:
# VITE_HUB_URL=http://localhost:5175

# Gemini API Key
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# ❌ DO NOT ADD: VITE_SUPABASE_JWT_SECRET
# JWT secret exists ONLY in Edge Function - never in client code!
4. Remove Jose Dependency
File: package.json

Changes needed:

Remove "jose": "^5.10.0" from dependencies (line 21)
Run npm install to update package-lock.json
5. Verify dbService.ts
File: services/dbService.ts (lines 1-928)

Verify:

Uses only VITE_SUPABASE_ANON_KEY (lines 29-32) ✅
No JWT secret references ✅
Proper auth configuration with storage (lines 40-45) ✅
No changes needed - already correct!

6. Update Documentation
File: docs/SSO-IMPLEMENTATION-COMPLETE.md

Changes needed:

Update to reflect removal of JWT verification
Document that JWT secret is NOT in client code
Update security section to explain server-side validation
Add notes about the new simplified approach
Security Improvements
Before (Insecure)
❌ JWT secret exposed in client bundle
❌ Client-side signature verification
❌ jose library increases bundle size
❌ Secret in environment variables (VITE_ prefix exposes it)
After (Secure)
✅ JWT secret only in Edge Function
✅ Server-side validation via Supabase auth API
✅ No crypto libraries needed on client
✅ Smaller bundle size
✅ Custom JWT treated as metadata only
✅ Anon key only (public, safe to expose)
Files to Modify
services/SSOReceiver.ts - Complete rewrite (remove jose, add setSession)
App.tsx - Simplify SSO integration (remove verification)
.env.example - Remove JWT secret, add comments
package.json - Remove jose dependency
docs/SSO-IMPLEMENTATION-COMPLETE.md - Update documentation
Files to Verify (No Changes)
services/dbService.ts - Already uses anon key only ✅
components/AuthPage.tsx - Standalone auth still works ✅
Verification Steps
After implementation:

✅ Build check: npm run build - ensure no JWT_SECRET in bundle
✅ Search check: grep -r "JWT_SECRET" dist/ should return nothing
✅ Type check: npm run type-check should pass
✅ Manual test: SSO flow from Hub should work
✅ Security audit: No secrets in client code
✅ Origin validation: No "unauthorized origin" errors in console
✅ Database access: Can query Chef schema from authenticated session

Production Testing Checklist:
1. ✅ Log into Hub at https://fitcopilot.app
2. ✅ Navigate to Chef app
3. ✅ Chef loads without requiring separate login
4. ✅ Can access Chef database
5. ✅ No console errors
6. ✅ Session persists across page refreshes
Expected Outcome
✅ Chef receives SSO tokens from Hub via postMessage
✅ Tokens include access_token and refresh_token from Supabase
✅ Chef calls supabase.auth.setSession() to establish session
✅ Supabase validates tokens server-side
✅ User authenticated without exposing any secrets
✅ Smaller, more secure client bundle

Production Status
🎉 WORKING IN PRODUCTION
- Hub URL updated to https://fitcopilot.app
- SSO flow functional across Hub, Trainer, and Chef
- Database connections established successfully
- No JWT secrets exposed in client code

Reference Documentation
For detailed implementation guidance, see:
- docs/SSO_ARCHITECTURE.md - Overall architecture
- docs/SSO_IMPLEMENTATION_GUIDE.md - Step-by-step code implementation
- docs/SSO_DEPLOYMENT_GUIDE.md - Deployment instructions
- docs/SSO_COHESIVE_IMPLEMENTATION_SUMMARY.md - Quick summary
- docs/HUB_URL_UPDATE_GUIDE.md - Hub URL configuration across services