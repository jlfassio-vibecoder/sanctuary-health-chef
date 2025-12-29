Chef App Firebase SSO Migration Plan
This plan provides step-by-step instructions for migrating the Chef app to Firebase SSO authentication, matching the exact implementation used in the Trainer app.

Current State
Chef app: Likely using Supabase SSO or postMessage-based SSO
Hub app: Using Firebase SSO (generates tokens for both Trainer and Chef)
Target: Chef app should use Firebase SSO like Trainer app
Prerequisites
Chef app codebase access
Same Firebase project as Hub and Trainer: sanctuary-health
Hub app API endpoint available: /api/exchange-firebase-sso-token
Node.js and npm installed
Migration Steps
Step 1: Install Firebase Dependencies
In the Chef app directory:

npm install firebase
Step 2: Configure Environment Variables
Create or update .env.local in Chef app root:

# Firebase Configuration (must match Hub app exactly)
# Get these values from Firebase Console > Project Settings > Your apps > Chef app
VITE_FIREBASE_API_KEY=your-api-key-here
VITE_FIREBASE_AUTH_DOMAIN=sanctuary-health.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sanctuary-health
VITE_FIREBASE_STORAGE_BUCKET=sanctuary-health.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
VITE_FIREBASE_APP_ID=your-app-id-here
VITE_FIREBASE_MEASUREMENT_ID=your-measurement-id-here

# Hub URL for SSO API endpoint
# For development:
VITE_HUB_URL=http://localhost:5175
# For production:
# VITE_HUB_URL=https://sanctuary-health.web.app

# Note: The code automatically detects development mode and defaults to
# http://localhost:5175 in dev, https://sanctuary-health.web.app in production
# if VITE_HUB_URL is not explicitly set. However, setting it explicitly is recommended.
Step 3: Create Firebase Initialization File
Create src/lib/firebase.ts in Chef app (copy from Trainer app):

Copy the entire file from Trainer app: src/lib/firebase.ts

Key requirements:

Singleton pattern for Firebase app initialization
Export auth and db instances
Handle emulator connection if needed
Support analytics initialization
Step 4: Copy Firebase SSO Service
Copy services/hub/FirebaseSSO.ts from Trainer app to Chef app at the same path: services/hub/FirebaseSSO.ts

This file contains:

exchangeFirebaseSSOToken() function - exchanges SSO token for Firebase Custom Token
getSSOTokenFromUrl() function - extracts token from URL parameters
useFirebaseSSO() hook - alternative hook implementation (optional, more robust)
Token redaction utilities for secure logging
Step 5: Create Firebase SSO Hook
Create hooks/useFirebaseSSOAuth.ts in Chef app (copy from Trainer app):

Copy the entire file from Trainer app: hooks/useFirebaseSSOAuth.ts

This hook:

Checks for existing Firebase Auth session
Reads SSO token from URL if present
Exchanges SSO token for Firebase Custom Token via Hub API
Signs in with custom token to establish Firebase Auth session
Listens for auth state changes
Step 6: Update App.tsx (Main Entry Point)
Update Chef app's App.tsx (or main entry component):

Before (Supabase/old SSO):

```typescript

import { useSchemaBasedSSO } from '@/services/hub/SchemaBasedSSO';

import { supabase } from '@/lib/supabase';

function A



After (Firebase SSO):

import { useFirebaseSSOAuth } from './hooks/useFirebaseSSOAuth';
import { getSSOTokenFromUrl } from './services/hub/FirebaseSSO';

function App() {
  // Use Firebase SSO (URL-based token exchange)
  const { user, isLoading, error } = useFirebaseSSOAuth();

  // Debug: Check for SSO token on app initialization (optional)
  React.useEffect(() => {
    console.log('🔍 [DEBUG] App.tsx: Initializing, checking for SSO token...');
    const token = getSSOTokenFromUrl();
    if (token) {
      console.log('✅ [DEBUG] App.tsx: SSO token detected in URL on mount');
    } else {
      console.log('ℹ️ [DEBUG] App.tsx: No SSO token in URL on mount');
    }
  }, []);

  // Log authentication state for debugging (optional)
  React.useEffect(() => {
    if (error) {
      console.error('❌ App.tsx: SSO error:', error);
    }
    if (user) {
      console.log('✅ App.tsx: User authenticated via Firebase SSO:', user.email);
    }
  }, [user, error]);

  // Rest of app...
}


Key Changes:

Replace useSchemaBasedSSO(supabase) with useFirebaseSSOAuth()
Remove Supabase session handling (Firebase Auth doesn't use sessions)
Use Firebase user instead of Supabase user and session
Remove session variable (not needed with Firebase)
Step 7: Update User ID References
Search and replace all references to Supabase user ID with Firebase user ID:

Before:

import type { User } from '@supabase/supabase-js';
const userId = user?.id; // Supabase uses .id


After:

import type { User } from 'firebase/auth';
const userId = user?.uid; // Firebase uses .uid


Common changes throughout Chef app:

user.id → user.uid
session.access_token → Use user.getIdToken() for Firebase ID tokens (if needed)
Supabase session object → Not needed with Firebase (use auth.currentUser)
Note: If Chef app uses a useAuth hook that transforms Firebase user to { id: user.uid, email: ... }, then user.id may still work. Check the hook implementation.

Step 8: Remove Old SSO Code
Files to remove or update:

src/services/hub/SchemaBasedSSO.ts (if exists) - Remove Supabase SSO implementation
src/services/hub/SSOReceiver.ts (if exists) - Remove postMessage-based SSO
Remove any Supabase SSO-related imports and code
Note: Keep Supabase client initialization only if Chef app still uses Supabase for database. Firebase Auth and Supabase database can coexist.

Step 9: Update Database Queries (If Using Firestore)
If Chef app queries Firestore directly, ensure queries use Firebase Auth:

Before (Supabase):

const { data } = await supabase.from('recipes').select('*').eq('user_id', user.id);


After (Firestore with Firebase Auth):

import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipesRef = collection(db, 'recipes');
const q = query(recipesRef, where('user_id', '==', user.uid));
const snapshot = await getDocs(q);
const data = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));


Step 10: Update Protected Route Components
If Chef app has protected route components, update them to use Firebase Auth:

Before:

import type { User } from '@supabase/supabase-js';
if (!user || !session) return <Navigate to="/login" />;


After:

import type { User } from 'firebase/auth';
if (!user) return <Navigate to="/login" />;
// No session check needed - Firebase Auth handles this


How Firebase SSO Works
Hub generates token: When user clicks to open Chef app, Hub calls generateFirebaseSSOToken('chef')
Token stored in Firestore: Token is stored in sso_tokens collection with user's Firebase ID token
Hub redirects to Chef: Chef app URL includes ?sso_token=<token>
Chef reads token: useFirebaseSSOAuth() hook reads token from URL
Chef exchanges token: Calls /api/exchange-firebase-sso-token endpoint (Hub API)
Server generates custom token: Server verifies token, generates Firebase custom token
Chef authenticates: Uses signInWithCustomToken() to establish Firebase Auth session
User authenticated: Chef app now has same Firebase Auth user as Hub
Testing Checklist
After implementing changes:

[ ] Firebase dependencies installed
[ ] Environment variables set correctly in .env.local
[ ] src/lib/firebase.ts created with proper initialization
[ ] services/hub/FirebaseSSO.ts copied from Trainer app
[ ] hooks/useFirebaseSSOAuth.ts created
[ ] App.tsx updated to use useFirebaseSSOAuth() hook
[ ] All user.id changed to user.uid throughout Chef app
[ ] Old Supabase SSO code removed
[ ] Chef app authenticates when opened from Hub
[ ] User state persists after page refresh
[ ] Error handling works (invalid token, network errors)
[ ] No console errors
Troubleshooting
"Missing token" error
Cause: useFirebaseSSOAuth() is being called when there's no token in URL
Fix: This is normal if app is accessed directly (not from Hub). App should show auth screen or redirect to Hub.
"Invalid or expired SSO token" error
Cause: Token expired (tokens expire after 1 hour) or already used
Fix: Return to Hub and generate new token
Firebase Auth not initialized
Cause: Firebase config missing or incorrect
Fix: Check environment variables and verify src/lib/firebase.ts exports auth and db
API endpoint 404 or CORS error
Cause: Hub API endpoint not accessible or CORS not configured
Fix: Verify Hub app is running (localhost:5175 for dev) and API endpoint /api/exchange-firebase-sso-token exists and allows Chef app origin
User ID mismatch errors
Cause: Code still using user.id instead of user.uid
Fix: Search and replace all instances of user.id with user.uid or update useAuth hook to transform uid to id
Files to Copy from Trainer App
src/lib/firebase.ts → Chef app src/lib/firebase.ts