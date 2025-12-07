# SSO Architecture - Cross-Domain Authentication

## Overview

The FitCopilot ecosystem uses **SSO (Single Sign-On)** to enable seamless authentication across three applications deployed on different domains, while sharing a single Supabase database.

## Architecture Context

### Deployment Setup
- **Hub:** Deployed on primary domain
- **Trainer:** `https://fitcopilot-trainer.vercel.app/`
- **Chef:** `https://personalchef.app/`

### Database Setup
- **Single Supabase Database** with multi-schema organization
  - `public` schema: Auth, subscriptions, shared infrastructure
  - `trainer` schema: Workout and exercise data
  - `chef` schema: Recipe and nutrition data

## Why SSO is Required

### The Cross-Domain Session Problem

Even though all three apps share the same Supabase database and `auth.users` table, **browser security prevents session sharing across different domains**.

#### Without SSO:
```
1. User signs into Hub → Session on hub.domain.com
   ✅ User authenticated on Hub

2. Hub loads Trainer iframe → fitcopilot-trainer.vercel.app
   ❌ Trainer cannot access Hub's session (different domain)
   ❌ User must sign in AGAIN in Trainer

3. User navigates to Chef → personalchef.app
   ❌ Chef cannot access Hub's session (different domain)
   ❌ User must sign in AGAIN in Chef

Result: User signs in 3 separate times! 😞
```

#### With SSO:
```
1. User signs into Hub → Session created
   ✅ User authenticated on Hub

2. Hub loads Trainer iframe
   → Hub generates SSO token via Edge Function (server-side)
   → Token includes Supabase access_token + refresh_token
   → Hub passes token to Trainer via postMessage
   → Trainer calls supabase.auth.setSession() with tokens
   → Supabase validates tokens server-side
   → Trainer creates local authenticated session
   ✅ User authenticated on Trainer (no sign-in required)

3. User navigates to Chef
   → Same SSO flow
   ✅ User authenticated on Chef (no sign-in required)

Result: User signs in ONCE! 🎉
NO JWT secret needed on client-side! 🔒
```

## SSO vs Shared Database

This is a common point of confusion:

| Feature | Shared Database | SSO |
|---------|----------------|-----|
| **Purpose** | Share data & auth source | Share sessions across domains |
| **Solves** | Data duplication | Cross-domain authentication |
| **Enables** | Unified auth.users table | Seamless user experience |
| **Required for** | Single source of truth | Different domain deployments |

**Key Insight:** Shared database provides **unified authentication source**, SSO provides **session sharing across domains**.

## Technical Implementation

### 1. Token Generation (Hub Side)

**File:** `src/services/hub/SSOService.ts`

The Hub generates signed JWT tokens when loading Trainer/Chef:

```typescript
const token = await ssoService.generateToken('trainer');
// Calls edge function: supabase/functions/generate-app-token/index.ts
```

**Token Contents:**
```json
{
  "sub": "user-uuid",
  "email": "user@example.com",
  "tier": "premium",
  "app_access": { "trainer": true, "chef": true },
  "iss": "fitcopilot-hub",
  "aud": "fitcopilot-apps",
  "exp": 1234567890
}
```

**Security:**
- Signed server-side in Edge Function with `SUPABASE_JWT_SECRET` (HS256)
- Expires in 1 hour
- JWT secret NEVER exposed to client-side code
- Token validation happens via Supabase auth.setSession() (server-side)
- Custom JWT treated as metadata only - no client-side verification needed

### 2. Token Passing

**Two methods for redundancy:**

#### Method A: URL Parameter (Primary)
```typescript
const url = new URL('https://fitcopilot-trainer.vercel.app');
url.searchParams.set('sso_token', token.token);
// Result: https://fitcopilot-trainer.vercel.app/?sso_token=eyJhbG...
```

#### Method B: postMessage (Backup)
```typescript
iframe.contentWindow.postMessage(
  { type: 'SSO_TOKEN', token: tokenData },
  'https://fitcopilot-trainer.vercel.app'
);
```

### 3. Token Reception (Trainer/Chef Side)

**File:** `src/services/hub/SSOReceiver.ts` (reference implementation for Trainer/Chef)

Trainer/Chef apps:
1. Receive SSO message via postMessage from Hub
2. Extract `access_token` and `refresh_token` from message
3. Call `supabase.auth.setSession()` with these tokens
4. Supabase validates tokens server-side and creates session
5. Store minimal session metadata in sessionStorage

```typescript
// ⭐ CRITICAL: Establish Supabase session (server-side validation)
const session = await ssoReceiver.establishSupabaseSession(
  supabaseClient,
  tokenData
);
// Token validated by Supabase server-side
// Local authenticated session created
// Ready to query database
```

**NO client-side JWT verification** - The custom JWT is metadata only. All validation happens server-side via Supabase's auth API.

## Security Model

### Server-Side Only Secrets
- **SUPABASE_JWT_SECRET:** Exists ONLY in Edge Function environment
  - ❌ NOT in Hub client code
  - ❌ NOT in Trainer client code
  - ❌ NOT in Chef client code
  - ✅ ONLY in Supabase Edge Function: `generate-app-token`
- **Environment Variables:**
  - Edge Function: `SUPABASE_JWT_SECRET` (server-side only)
  - Hub/Trainer/Chef: `VITE_SUPABASE_URL` + `VITE_SUPABASE_ANON_KEY` only

### Token Lifecycle
1. **Generation:** Edge Function creates signed JWT (server-side only)
2. **Packaging:** Includes Supabase `access_token` + `refresh_token`
3. **Transmission:** postMessage over HTTPS with origin validation
4. **Validation:** Supabase validates tokens server-side via `auth.setSession()`
5. **Expiration:** 1-hour lifespan
6. **Refresh:** User can request new token via postMessage

### Security Features
- ✅ **Server-side JWT signing** - Secret never exposed to client
- ✅ **No client-side JWT verification** - Clients treat JWT as opaque metadata
- ✅ **Supabase validates tokens** - All validation server-side via auth API
- ✅ **Token expiration** - 1-hour lifespan
- ✅ **Origin validation** - postMessage only from allowed origins
- ✅ **HTTPS-only** - Enforced in production
- ✅ **Nonce-based CSRF protection** - Prevents replay attacks
- ✅ **Anon key only** - Clients use only public anon key

## Message Protocol

### Hub → Trainer/Chef Messages

```typescript
// Token delivery
{
  type: 'SSO_TOKEN',
  token: {
    token: 'eyJhbG...',          // Custom JWT (metadata only)
    expires_at: '2025-01-01T12:00:00Z',
    tier: 'premium',
    user_id: 'uuid',
    // ⭐ CRITICAL: Supabase session tokens for auth.setSession()
    access_token: 'sb-access-...',
    refresh_token: 'sb-refresh-...'
  }
}

// Error notification
{
  type: 'SSO_ERROR',
  error: 'Token generation failed'
}
```

### Trainer/Chef → Hub Messages

```typescript
// Ready to receive token
{
  type: 'SSO_READY'
}

// Request token refresh
{
  type: 'SSO_TOKEN_REFRESH'
}
```

## Flow Diagrams

### Initial Authentication Flow
```
User                Hub                  Edge Function        Trainer/Chef
  |                  |                        |                   |
  |-- Sign In ------>|                        |                   |
  |                  |-- Create Session ----->|                   | (Supabase)
  |                  |<-- Session Created ----|                   |
  |<-- Logged In ----|                        |                   |
  |                  |                        |                   |
  |-- Click Trainer->|                        |                   |
  |                  |-- Request Token ------>|                   |
  |                  |   (w/ access/refresh)  |                   |
  |                  |                    [Sign JWT w/ secret]    |
  |                  |<-- Token Package ------|                   |
  |                  |   (JWT + access_token + refresh_token)     |
  |                  |                        |                   |
  |                  |-- Load Iframe -------------------------------->|
  |                  |                        |                   |
  |                  |-- postMessage (SSO_TOKEN) ------------------>|
  |                  |                        |                   |
  |                  |                        |     [Receive tokens]
  |                  |                        |     [Call setSession()]
  |                  |                        |                   |-- Validate -->| (Supabase)
  |                  |                        |                   |<-- Valid -----|
  |                  |                        |     [Session created, user authenticated]
  |<-- Trainer Loaded (user logged in) ---------------------------|
```

### Token Refresh Flow
```
Trainer/Chef         Hub                  Edge Function
  |                  |                        |
  |-- Token Expired->|                        |
  |                  |                        |
  |-- SSO_TOKEN_REFRESH ->|                   |
  |                  |                        |
  |                  |-- Generate New Token ->|
  |                  |<-- New JWT ------------|
  |                  |                        |
  |<-- SSO_TOKEN ----|                        |
  |                  |                        |
  |-- Verify & Set ->|                        |
  |<-- Refreshed ----|                        |
```

## Configuration Requirements

### Hub Configuration

**.env (Production):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_EXTERNAL_TRAINER_URL=https://fitcopilot-trainer.vercel.app/
VITE_EXTERNAL_CHEF_URL=https://personalchef.app/
```

**.env.local (Development):**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
VITE_EXTERNAL_TRAINER_URL=http://localhost:3001
VITE_EXTERNAL_CHEF_URL=http://localhost:3002
```

### Trainer Configuration

**.env or .env.local:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co  # Same as Hub
VITE_SUPABASE_ANON_KEY=your-anon-key                 # Same as Hub
VITE_HUB_URL=https://hub.fitcopilot.com             # For origin validation
# ❌ NO VITE_SUPABASE_JWT_SECRET - This is a security risk!
```

### Chef Configuration

**.env or .env.local:**
```bash
VITE_SUPABASE_URL=https://your-project.supabase.co  # Same as Hub
VITE_SUPABASE_ANON_KEY=your-anon-key                 # Same as Hub
VITE_HUB_URL=https://hub.fitcopilot.com             # For origin validation
# ❌ NO VITE_SUPABASE_JWT_SECRET - This is a security risk!
```

### Edge Function Configuration (Supabase Dashboard)

**CRITICAL:** JWT secret exists ONLY in Edge Function environment:

```bash
SUPABASE_JWT_SECRET=your-secret-here
```

Set this in: **Supabase Dashboard → Edge Functions → generate-app-token → Environment Variables**

## Common Misconceptions

### ❌ "We have a shared database, so we don't need SSO"

**Wrong!** Shared database means:
- ✅ Same user records (`auth.users`)
- ✅ Same authentication source
- ❌ Does NOT mean shared sessions across domains

Browser security (Same-Origin Policy) prevents `fitcopilot-trainer.vercel.app` from accessing sessions created on `hub.example.com`.

### ❌ "SSO is only for multiple databases"

**Wrong!** SSO can serve two purposes:
1. **Identity Federation:** Sync users across separate databases (traditional SSO)
2. **Session Sharing:** Share authentication state across domains (our use case)

We use SSO for #2 - sharing sessions across domains while querying the same database.

### ✅ "SSO enables seamless UX across domains with shared auth backend"

**Correct!** SSO bridges the gap between:
- **Backend:** Single database with unified `auth.users`
- **Frontend:** Multiple domains that can't natively share sessions

## Benefits

### User Experience
- ✅ Sign in **once** in Hub
- ✅ Access Trainer and Chef **without re-authentication**
- ✅ Seamless navigation between apps
- ✅ Consistent user identity across ecosystem

### Development
- ✅ Single source of truth for user data
- ✅ No need to sync auth databases
- ✅ Simplified access control (RLS on shared tables)
- ✅ Easy to add new apps to ecosystem

### Security
- ✅ Cryptographically signed tokens
- ✅ Short-lived tokens (1 hour)
- ✅ Origin validation on postMessage
- ✅ HTTPS enforced in production

## Alternatives Considered

### Alternative 1: Shared Top-Level Domain
**Approach:** Deploy all apps on subdomains of same domain
- `hub.fitcopilot.com`
- `trainer.fitcopilot.com`
- `chef.fitcopilot.com`

**Pros:** Could share cookies across subdomains  
**Cons:** Requires custom domain setup, DNS configuration, may not work with free Vercel hosting

### Alternative 2: Require Sign-In Per App
**Approach:** Users sign in separately on each domain

**Pros:** Simple, no SSO code needed  
**Cons:** Terrible UX - users annoyed by multiple sign-ins

### Alternative 3: Supabase OAuth Flow
**Approach:** Use Supabase's built-in OAuth redirect flow

**Pros:** Official Supabase feature  
**Cons:** Redirects user away from app, complex state management, poor UX in iframes

### ✅ Our Choice: JWT-based SSO
**Best balance of security, UX, and development simplicity**

## Troubleshooting

### "Session establishment failed" / "Invalid tokens"
- Verify Edge Function has `SUPABASE_JWT_SECRET` set correctly (NOT prefixed with VITE_)
- Check that Hub successfully received session tokens from Supabase
- Ensure `access_token` and `refresh_token` are included in SSO message
- Verify Supabase URL and anon key match across all apps

### "401 Unauthorized" in Trainer/Chef
- ✅ Check: SSO token was received via postMessage
- ✅ Check: `supabase.auth.setSession()` was called successfully
- ✅ Check: `supabase.auth.getSession()` returns valid session
- ✅ Check: Database queries use `.schema('trainer')` or `.schema('chef')`
- ✅ Check: RLS policies allow authenticated users to access tables

### "postMessage not working"
- Check that iframe origin matches `SSO_ALLOWED_ORIGINS` in Hub config
- Verify `VITE_HUB_URL` is set correctly in Trainer/Chef apps
- Check browser console for CORS or origin validation errors
- Ensure iframe sandbox allows `allow-same-origin` and `allow-scripts`

### "JWT secret exposed in client bundle"
- ❌ NEVER use `VITE_SUPABASE_JWT_SECRET` in client code
- ✅ Only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
- Build and search: `npm run build && grep -r "JWT_SECRET" dist/`
- Should return: nothing found

## Future Enhancements

1. **Token Refresh:** Automatic background refresh before expiration
2. **Multi-Tab Sync:** Broadcast session across tabs using BroadcastChannel API
3. **Session Persistence:** Store refresh tokens for longer sessions
4. **Audit Logging:** Track SSO token usage in `app_access_log` table

## Related Files

### Hub (Token Generation)
- `src/services/hub/SSOService.ts` - Token generation and iframe communication
- `src/routes/ExternalTrainer.tsx` - Trainer iframe with SSO integration
- `src/routes/ExternalChef.tsx` - Chef iframe with SSO integration
- `supabase/functions/generate-app-token/index.ts` - JWT signing edge function

### Trainer/Chef (Token Reception)
- `src/services/hub/SSOReceiver.ts` - Reference implementation for session establishment
- `docs/SSO_IMPLEMENTATION_GUIDE.md` - Step-by-step integration guide
- `docs/SSO_DEPLOYMENT_GUIDE.md` - Deployment and configuration guide

### Configuration
- `src/config/index.ts` - External app URLs and allowed origins
- `.env.local` - Local development configuration
- Vercel Dashboard - Production environment variables

## Summary

**SSO in FitCopilot is NOT about:**
- ❌ Syncing users across multiple databases
- ❌ Complex identity federation
- ❌ Enterprise SSO providers (Okta, Auth0, etc.)
- ❌ Client-side JWT verification with secrets

**SSO in FitCopilot IS about:**
- ✅ Sharing authentication sessions across different domains
- ✅ Seamless user experience (sign in once, access all apps)
- ✅ Server-side token validation via Supabase auth API
- ✅ Secure token passing using postMessage with origin validation
- ✅ Leveraging shared Supabase database while handling cross-domain constraints
- ✅ Using only public anon keys on client-side

**KEY SECURITY PRINCIPLE:** JWT secret exists ONLY in Edge Function. Clients use `supabase.auth.setSession()` with Supabase tokens - all validation happens server-side.

**Bottom Line:** SSO bridges the gap between our unified backend (single database) and distributed frontend (multiple domains) **without exposing secrets to client code**.

