# Chef App Schema-Based SSO Migration - Implementation Complete

## ✅ Implementation Status

The Chef app has been successfully migrated from postMessage-based SSO to schema-based SSO (URL-based token exchange).

## Changes Made

### 1. App.tsx Updated ✅
- ✅ Removed `ssoReceiver` import
- ✅ Added `useSchemaBasedSSO` and `getSSOTokenFromUrl` imports
- ✅ Replaced `ssoReceiver.initialize()` useEffect with `useSchemaBasedSSO` hook
- ✅ Updated session/user state management to use combined SSO + standard auth
- ✅ Added debug logging for token detection
- ✅ Updated loading state to include SSO loading

### 2. SchemaBasedSSO.ts Verified ✅
- ✅ File exists and is complete (456 lines)
- ✅ Contains `useSchemaBasedSSO` hook
- ✅ Contains `exchangeSSOToken` function
- ✅ Contains `exchangeSSOTokenAndSetSession` function
- ✅ Contains `getSSOTokenFromUrl` debug function
- ✅ Uses RPC function `exchange_sso_token` as primary method
- ✅ Has fallback to direct table query
- ✅ Handles token cleanup from URL
- ✅ Handles token deletion from database after exchange

### 3. Database RPC Function ✅
- ✅ Should already exist from Trainer app migration
- ⚠️ **Manual verification required:** Run SQL query to confirm:
  ```sql
  SELECT routine_name, security_type
  FROM information_schema.routines
  WHERE routine_schema = 'public'
    AND routine_name = 'exchange_sso_token';
  ```

## Testing Checklist

### Pre-Testing Setup
1. Ensure Hub app is running and updated to use schema-based SSO
2. Ensure Chef app dev server is running
3. Clear browser cache and localStorage/sessionStorage

### Test Flow
1. **Start Hub app:** Navigate to Hub (e.g., `http://localhost:5173`)
2. **Authenticate in Hub:** Login if not already authenticated
3. **Navigate to Chef from Hub:** Click Chef app link/button
4. **Check browser console for expected logs:**
   - `✅ [DEBUG] useSchemaBasedSSO: Token captured immediately on mount` (Chef)
   - `🔐 SchemaBasedSSO: Attempting RPC function (bypasses RLS)...` (Chef)
   - `✅ SchemaBasedSSO: Token exchanged via RPC function` (Chef)
   - `✅ SchemaBasedSSO: Successfully exchanged SSO token for session` (Chef)
   - `✅ App.tsx: User authenticated via schema-based SSO` (Chef)
   - **No postMessage errors should appear**

5. **Verify behavior:**
   - ✅ URL is cleaned (no `?sso_token=xxx` visible in address bar)
   - ✅ User is authenticated (can access protected routes)
   - ✅ Session persists after page refresh
   - ✅ No console errors
   - ✅ User can navigate between views without losing session

### Edge Cases to Test
- Direct navigation to Chef app (no SSO token) - should show AuthPage
- Expired token (wait 5+ minutes) - should handle gracefully
- Invalid token - should show error and fall back to AuthPage

## Troubleshooting

### Issue: Token not captured from URL
- **Check:** Browser console for `🔍 [DEBUG] Full URL:` log
- **Solution:** Verify React Router isn't stripping query params. The hook captures token synchronously on mount to prevent this.

### Issue: RPC function fails
- **Check:** Run SQL verification query (see above)
- **Solution:** Ensure function exists, has `SECURITY DEFINER`, and is granted to `anon` and `authenticated` roles

### Issue: Token exchange fails
- **Check:** Database query: `SELECT * FROM sso_tokens WHERE token = 'xxx' AND expires_at > NOW();`
- **Solution:** Verify token exists, hasn't expired (5-minute window), and `target_app = 'chef'`

### Issue: Session not established
- **Check:** Console for `setSession` errors
- **Solution:** Verify Supabase client configuration, check `access_token` and `refresh_token` validity

## Post-Migration Cleanup (Optional)

After successful testing:
1. Remove debug logging (optional - can keep for production debugging)
2. Delete or archive `services/SSOReceiver.ts` (keep for rollback safety initially)
3. Update any documentation referencing old SSO approach
4. Remove any unused imports or references to `ssoReceiver`

## Rollback Plan

If issues arise:
1. Revert `App.tsx` changes (restore `ssoReceiver` usage)
2. Keep `SchemaBasedSSO.ts` file (don't delete)
3. Restore `SSOReceiver.ts` if deleted
4. Use feature flag to switch between implementations if needed

## Key Implementation Details

**App.tsx Integration:**
- Uses `useSchemaBasedSSO` hook for automatic SSO token processing
- Combines SSO session with standard Supabase auth session
- SSO session takes precedence when available
- Falls back gracefully if no token present
- Works alongside existing Supabase auth for direct login

**Why this works:**
- Hook handles all SSO token processing automatically
- Falls back gracefully if no token present
- Works alongside existing Supabase auth for direct login
- No manual token handling needed

## Differences from Trainer App

**None** - The implementation is identical:
- Same `SchemaBasedSSO.ts` service
- Same `useSchemaBasedSSO` hook
- Same RPC function (shared database)
- Same App.tsx integration pattern

**Only difference:** Hub passes `target_app = 'chef'` instead of `target_app = 'trainer'` when generating tokens, but the exchange logic is identical.

## Next Steps

1. ✅ Code implementation complete
2. ⏳ **Manual testing required** - Follow testing checklist above
3. ⏳ Verify RPC function exists in database
4. ⏳ Test complete SSO flow
5. ⏳ Test edge cases
6. ⏳ Cleanup old code (after verification)

---

**Migration Date:** $(date)
**Status:** ✅ Implementation Complete - Ready for Testing
