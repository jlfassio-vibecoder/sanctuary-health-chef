# Chef App Firebase SSO Integration Guide

This guide provides step-by-step instructions for integrating Firebase SSO authentication into the Chef app, enabling seamless cross-domain authentication from the Hub app.

---

## Overview

The Firebase SSO flow enables users to sign in once at the Hub app and automatically authenticate in the Chef app without additional login steps.

**Flow:**
1. User signs in at Hub app (Firebase Auth)
2. Hub generates SSO exchange token and passes it via URL: `?sso_token=<uuid>`
3. Chef app receives token, exchanges it for Firebase Custom Token via backend API
4. Chef app signs in with custom token
5. User is authenticated and can access Chef features

---

## Prerequisites

- Chef app codebase
- Firebase project access (same project as Hub: `sanctuary-health`)
- Hub app API endpoint available: `/api/exchange-firebase-sso-token`
- Node.js and npm installed

---

## Step 1: Install Firebase Dependencies

```bash
npm install firebase
```

If you need logging utilities:
```bash
npm install # (check if logger utility exists or implement simple console logger)
```

---

## Step 2: Configure Environment Variables

Create or update `.env.local` in your Chef app root:

```bash
# Firebase Configuration (same as Hub app)
# Get these values from Firebase Console > Project Settings > Your apps > Chef app
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=sanctuary-health.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sanctuary-health
VITE_FIREBASE_STORAGE_BUCKET=sanctuary-health.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id-here

# Hub URL for SSO API endpoint
# For development:
VITE_HUB_URL=http://localhost:5175
# For production:
# VITE_HUB_URL=https://sanctuary-health.web.app
```

**Security Note:** Never commit actual credentials. Use `.env.local` (gitignored) for local development and GitHub Secrets for CI/CD.

**Important:** Use the same Firebase configuration as the Hub app to ensure shared authentication.

---

## Step 3: Create Firebase Initialization File

Create `src/lib/firebase.ts`:

```typescript
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Check if Firebase is properly configured
export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

// Initialize Firebase App (singleton pattern)
let app: FirebaseApp;

function createFirebaseApp(): FirebaseApp {
  // Check if already initialized
  const existingApps = getApps();
  if (existingApps.length > 0) {
    return existingApps[0];
  }

  if (!firebaseConfig.apiKey || !firebaseConfig.authDomain || !firebaseConfig.projectId) {
    throw new Error(
      'Firebase configuration is incomplete. Please set VITE_FIREBASE_API_KEY, VITE_FIREBASE_AUTH_DOMAIN, and VITE_FIREBASE_PROJECT_ID environment variables.'
    );
  }

  app = initializeApp(firebaseConfig);
  return app;
}

// Initialize Firebase App
app = createFirebaseApp();

// Initialize services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators in development if configured
if (
  import.meta.env.DEV &&
  import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true'
) {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099', {
      disableWarnings: true,
    });
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    console.warn('Firebase emulators not available:', error);
  }
}

export default app;
```

---

## Step 4: Create SSO Service File

Create `src/services/hub/FirebaseSSO.ts` (copy from Hub app or implement as shown below):

```typescript
/**
 * Firebase SSO Service for Chef App
 * 
 * Handles cross-domain authentication from Hub app via Firebase SSO.
 */

import { auth } from '@/lib/firebase';
import { signInWithCustomToken } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { useState, useEffect } from 'react';

// Type definitions
export interface SSOTokenData {
  id_token: string;
  user_id: string;
  email: string;
  expires_at: number;
  custom_token: string;
}

/**
 * Exchange SSO exchange token for Firebase Custom Token
 * 
 * This calls the Hub app's backend API to exchange the SSO exchange token
 * (UUID from URL) for a Firebase Custom Token that can be used to authenticate.
 * 
 * @param token - SSO exchange token (UUID) from URL parameter
 * @returns Token data including custom_token for authentication
 */
export async function exchangeFirebaseSSOToken(
  token: string
): Promise<SSOTokenData> {
  // Get Hub URL from environment variable
  const hubUrl = import.meta.env.VITE_HUB_URL || 'http://localhost:5173';
  const apiUrl = `${hubUrl}/api/exchange-firebase-sso-token`;

  try {
    // Call backend API to exchange SSO token for custom token
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sso_token: token }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = { error: 'Unknown error' };
      try {
        errorData = await response.json();
      } catch {
        // Response body is not JSON, use default error
      }
      
      if (response.status === 404) {
        throw new Error('Invalid or expired SSO token');
      } else if (response.status === 400) {
        throw new Error(errorData.error || 'SSO token has expired');
      } else if (response.status === 401) {
        throw new Error('Invalid ID token in SSO token');
      } else if (response.status >= 500) {
        throw new Error(errorData.error || 'Server error occurred. Please try again later.');
      } else {
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    
    if (!data.custom_token || !data.user_id) {
      throw new Error('Invalid response from server: missing required fields');
    }

    const expiresAt = data.expires_at 
      ? new Date(data.expires_at) 
      : new Date(Date.now() + 60 * 60 * 1000); // Default 1 hour

    console.debug('✅ Successfully exchanged Firebase SSO token for custom token');

    return {
      id_token: '', // Not needed after exchange
      user_id: data.user_id,
      email: '', // Will be populated from authenticated user
      expires_at: expiresAt.getTime(),
      custom_token: data.custom_token,
    };
  } catch (error) {
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      console.error('Failed to exchange Firebase SSO token:', error);
      throw error;
    }
    // Handle network errors and other unexpected errors
    console.error('Failed to exchange Firebase SSO token:', error);
    throw new Error('Network error: Unable to connect to authentication server');
  }
}

/**
 * Get SSO exchange token from URL parameters
 * Also removes the token from URL for security
 */
export function getSSOTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('sso_token');

  if (token) {
    // Clean URL to remove token from browser history
    const url = new URL(window.location.href);
    url.searchParams.delete('sso_token');
    window.history.replaceState({}, document.title, url.toString());
  }

  return token;
}

/**
 * React hook for Chef app to authenticate via Firebase SSO
 * 
 * Usage:
 * ```tsx
 * import { useFirebaseSSO } from '@/services/hub/FirebaseSSO';
 * 
 * function App() {
 *   const { user, isLoading, error } = useFirebaseSSO();
 * 
 *   if (isLoading) return <div>Loading...</div>;
 *   if (error) return <div>Error: {error.message}</div>;
 *   if (!user) return <div>Not authenticated. Please sign in via Hub.</div>;
 * 
 *   return <div>Welcome, {user.email}!</div>;
 * }
 * ```
 */
export function useFirebaseSSO() {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    async function initAuth() {
      try {
        // First, check if we already have a user (existing session)
        const currentUser = auth.currentUser;
        if (currentUser) {
          setUser(currentUser);
          setIsLoading(false);
          return;
        }

        // Check URL for SSO exchange token
        const token = getSSOTokenFromUrl();
        if (!token) {
          setIsLoading(false);
          return; // No token, user needs to authenticate via Hub
        }

        // Exchange SSO exchange token for custom token
        let tokenData: SSOTokenData;
        try {
          tokenData = await exchangeFirebaseSSOToken(token);
        } catch (exchangeError) {
          // Handle exchange errors with specific messages
          if (exchangeError instanceof Error) {
            if (exchangeError.message.includes('Invalid or expired')) {
              throw new Error('SSO token is invalid or has expired. Please return to the Hub and try again.');
            } else if (exchangeError.message.includes('Server error')) {
              throw new Error('Unable to verify SSO token. Please try again later.');
            }
          }
          throw exchangeError;
        }

        // Sign in with the custom token to establish Firebase Auth session
        let userCredential;
        try {
          userCredential = await signInWithCustomToken(auth, tokenData.custom_token);
        } catch (signInError) {
          console.error('Failed to sign in with custom token:', signInError);
          throw new Error('Failed to authenticate. Please return to the Hub and try again.');
        }

        // User is now authenticated
        setUser(userCredential.user);
        setError(null);
      } catch (err) {
        console.error('Firebase SSO failed:', err);
        const errorMessage = err instanceof Error 
          ? err.message 
          : 'Authentication failed. Please return to the Hub and try again.';
        setError(new Error(errorMessage));
      } finally {
        setIsLoading(false);
      }
    }

    // Listen for auth state changes (handles sign-out, token refresh, etc.)
    const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
      setUser(firebaseUser);
      setIsLoading(false);
    });

    // Initialize authentication
    initAuth();

    // Cleanup subscription on unmount
    return () => unsubscribe();
  }, []);

  return { user, isLoading, error };
}
```

**Note:** Adjust the import path (`@/lib/firebase`, `@/services/hub/FirebaseSSO`) to match your project's path alias configuration.

---

## Step 5: Integrate SSO Hook in Your App

Update your main `App.tsx` or root component:

```tsx
import { useFirebaseSSO } from '@/services/hub/FirebaseSSO';

function App() {
  const { user, isLoading, error } = useFirebaseSSO();

  // Show loading state while checking authentication
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="loading loading-spinner loading-lg"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // Show error state
  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-red-50 border border-red-200 rounded-lg">
          <h2 className="text-xl font-semibold text-red-800 mb-2">
            Authentication Error
          </h2>
          <p className="text-red-600 mb-4">{error.message}</p>
          <a
            href={import.meta.env.VITE_HUB_URL || '#'}
            className="text-blue-600 hover:underline"
          >
            Return to Hub
          </a>
        </div>
      </div>
    );
  }

  // Show not authenticated state (user should access via Hub)
  if (!user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center max-w-md p-6 bg-yellow-50 border border-yellow-200 rounded-lg">
          <h2 className="text-xl font-semibold text-yellow-800 mb-2">
            Not Authenticated
          </h2>
          <p className="text-yellow-600 mb-4">
            Please sign in via the Hub app to access the Chef.
          </p>
          <a
            href={import.meta.env.VITE_HUB_URL || '#'}
            className="text-blue-600 hover:underline"
          >
            Go to Hub
          </a>
        </div>
      </div>
    );
  }

  // User is authenticated - render your app
  return (
    <div>
      <header>
        <p>Welcome, {user.email}!</p>
        {/* Your app content */}
      </header>
      {/* Rest of your Chef app */}
    </div>
  );
}

export default App;
```

---

## Step 6: Access Custom Claims for Authorization

The Firebase Custom Token may include custom claims (subscription tier, app access) that you can use for authorization:

```tsx
import { auth } from '@/lib/firebase';

// Get user's subscription tier and app access
async function getUserClaims() {
  const user = auth.currentUser;
  if (!user) return null;

  const idTokenResult = await user.getIdTokenResult();
  
  return {
    tier: idTokenResult.claims.tier as string | undefined, // 'free' | 'pro' | 'elite' | 'enterprise'
    app_access: idTokenResult.claims.app_access as Record<string, boolean> | undefined,
    userId: idTokenResult.claims.user_id as string,
  };
}

// Usage in a component
function ChefDashboard() {
  const [claims, setClaims] = useState<any>(null);

  useEffect(() => {
    getUserClaims().then(setClaims);
  }, []);

  if (!claims) return <div>Loading...</div>;

  // Check if user has chef access
  if (claims.app_access?.chef !== true) {
    return <div>You don't have access to the Chef app.</div>;
  }

  // Check subscription tier for feature gating
  const isPremium = claims.tier === 'elite' || claims.tier === 'enterprise';

  return (
    <div>
      <h1>Chef Dashboard</h1>
      <p>Subscription: {claims.tier}</p>
      {isPremium && <PremiumFeatures />}
    </div>
  );
}
```

---

## Step 7: Handle URL Parameters (Optional)

If the Hub passes additional URL parameters (like `view` or `recipe`), extract them before the SSO token is removed:

```tsx
useEffect(() => {
  // Capture view/recipe params before SSO token is removed
  const params = new URLSearchParams(window.location.search);
  const view = params.get('view');
  const recipe = params.get('recipe');
  
  if (view) {
    // Store for navigation after authentication
    sessionStorage.setItem('chef_pending_view', view);
  }
  
  if (recipe) {
    sessionStorage.setItem('chef_pending_recipe', recipe);
  }
}, []); // Run only on mount

// After authentication succeeds, navigate to pending view
useEffect(() => {
  if (user && !isLoading) {
    const pendingView = sessionStorage.getItem('chef_pending_view');
    const pendingRecipe = sessionStorage.getItem('chef_pending_recipe');
    
    if (pendingView) {
      // Navigate to the view
      navigate(`/${pendingView}${pendingRecipe ? `?recipe=${pendingRecipe}` : ''}`);
      sessionStorage.removeItem('chef_pending_view');
      sessionStorage.removeItem('chef_pending_recipe');
    }
  }
}, [user, isLoading]);
```

---

## Step 8: Testing the Integration

### 8.1 Local Development Testing

1. **Start Hub app:**
   ```bash
   # In Hub app directory
   npm run dev
   # Hub should run on http://localhost:5173
   ```

2. **Start Chef app:**
   ```bash
   # In Chef app directory
   npm run dev
   # Chef should run on http://localhost:5177 (or your configured port)
   ```

3. **Test Flow:**
   - Sign in to Hub app
   - Navigate to Chef route in Hub (e.g., `/chef`)
   - Hub should generate SSO token and load Chef iframe with `?sso_token=<uuid>`
   - Chef app should automatically authenticate
   - Verify user is logged in by checking `auth.currentUser`

### 8.2 Verify Authentication

Add a debug component to verify authentication:

```tsx
import { auth } from '@/lib/firebase';
import { useEffect, useState } from 'react';

function AuthDebug() {
  const [user, setUser] = useState(auth.currentUser);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(setUser);
    return unsubscribe;
  }, []);

  if (!user) return <div>Not authenticated</div>;

  return (
    <div className="p-4 bg-gray-100 rounded">
      <h3>Authentication Status</h3>
      <p>Email: {user.email}</p>
      <p>UID: {user.uid}</p>
      <button onClick={async () => {
        const tokenResult = await user.getIdTokenResult();
        console.log('Custom Claims:', tokenResult.claims);
      }}>
        Log Claims
      </button>
    </div>
  );
}
```

### 8.3 Test Error Cases

1. **Expired Token:** Wait 1 hour and try to use the same SSO token (should fail gracefully)
2. **Invalid Token:** Try accessing Chef with a fake token (should show error)
3. **No Token:** Access Chef directly without SSO token (should show "Not authenticated" message)

---

## Step 9: Production Deployment

### 9.1 Update Environment Variables

Ensure production environment variables are set:

```bash
# Production .env
# NEVER commit this file! Use GitHub Secrets for production builds
# Get values from Firebase Console > Project Settings > Your apps > Chef app
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=sanctuary-health.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sanctuary-health
VITE_FIREBASE_STORAGE_BUCKET=sanctuary-health.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id-here

# Production Hub URL
VITE_HUB_URL=https://sanctuary-health.web.app
```

**Important:** For production, set these as GitHub Secrets, not in `.env` files.

### 9.2 Verify CORS Configuration

Ensure the Hub app's API endpoint allows requests from your Chef app's domain. The backend should handle CORS properly for the `/api/exchange-firebase-sso-token` endpoint.

---

## Troubleshooting

### Issue: "Invalid or expired SSO token"

**Causes:**
- Token was already used (one-time use)
- Token expired (1 hour expiration)
- Token doesn't exist in Firestore

**Solution:** Return to Hub and navigate to Chef again to generate a new token.

### Issue: "Network error: Unable to connect to authentication server"

**Causes:**
- Hub URL is incorrect in `VITE_HUB_URL`
- Hub API endpoint is not accessible
- CORS issue

**Solution:**
- Verify `VITE_HUB_URL` environment variable
- Check Hub app is running and accessible
- Verify CORS configuration on Hub API endpoint

### Issue: User is not authenticated after SSO

**Causes:**
- `signInWithCustomToken()` failed
- Custom token is invalid
- Firebase Auth not properly initialized

**Solution:**
- Check browser console for errors
- Verify Firebase configuration is correct
- Ensure `auth` instance is properly initialized

### Issue: Custom claims are not available

**Causes:**
- User doesn't have a subscription
- Backend didn't include claims in custom token

**Solution:**
- Claims are optional - check if they exist before using
- Fall back to querying Firestore for subscription data if needed

---

## Security Considerations

1. **HTTPS Only:** Always use HTTPS in production for secure token transmission
2. **Token Cleanup:** SSO exchange tokens are automatically deleted after use (one-time use)
3. **Token Expiration:** Tokens expire after 1 hour for security
4. **No Client Access:** SSO tokens are stored in Firestore with server-only access rules
5. **Custom Claims:** Use custom claims for authorization, but validate critical operations server-side

---

## Next Steps

After SSO integration is complete:

1. Update your app's routing to require authentication
2. Implement feature gating based on custom claims (subscription tier)
3. Handle sign-out (redirect to Hub)
4. Add error boundaries for better error handling
5. Implement token refresh handling (Firebase handles this automatically)

---

## Support

If you encounter issues:

1. Check browser console for errors
2. Verify environment variables are set correctly
3. Ensure Hub app is running and API endpoint is accessible
4. Review Firebase Console for authentication events
5. Check Hub app logs for SSO exchange attempts
