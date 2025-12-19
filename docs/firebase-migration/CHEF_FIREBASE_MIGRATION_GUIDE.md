# Sanctuary Health Chef App Migration Guide

## Overview

This guide walks you through migrating the FitCopilot Chef app to the Sanctuary Health Chef app, including:
1. Firebase setup and configuration
2. SSO migration from Supabase to Firebase
3. Database migration from Supabase to Firestore (recipes, nutrition, shopping lists)
4. Branding updates
5. Configuration updates

---

## Prerequisites

- Copied FitCopilot Chef app codebase
- Firebase project `sanctuary-health` already set up (from Hub migration)
- Firebase CLI installed
- Node.js and npm installed
- **Note:** This migration follows the same pattern as the Trainer app migration

---

## Step 1: Firebase Setup

### 1.1 Install Firebase Dependencies

```bash
npm install firebase
npm install -g firebase-tools
```

### 1.2 Add Firebase Configuration

Create or update `.env.local` with Firebase configuration (same as Hub and Trainer):

```bash
# Firebase Configuration (same as Hub and Trainer apps)
VITE_FIREBASE_API_KEY=AIzaSyB65txHQK-GBhKOGZL72UP6-3hThf0nSvc
VITE_FIREBASE_AUTH_DOMAIN=sanctuary-health.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=sanctuary-health
VITE_FIREBASE_STORAGE_BUCKET=sanctuary-health.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=527662509976
VITE_FIREBASE_APP_ID=1:527662509976:web:c055cb81acc386d03ec5ed
VITE_FIREBASE_MEASUREMENT_ID=G-3J00S7P50E

# Hub URL for SSO
VITE_HUB_URL=http://localhost:5175  # For dev, or https://sanctuary-health.web.app for prod
```

**Important:** The `VITE_FIREBASE_APP_ID` should be the **Chef app's Firebase app ID**. You'll need to register the Chef app in Firebase Console and get its unique `appId`. If you haven't registered it yet, use the Trainer app's ID temporarily, then update it after registering.

### 1.3 Create Firebase Initialization File

Create `src/lib/firebase.ts` (copy from Hub or Trainer app):

```typescript
import { initializeApp, getApps, type FirebaseApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAnalytics, isSupported, type Analytics } from 'firebase/analytics';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID,
};

const isTestEnv = import.meta.env.MODE === 'test' || import.meta.env.VITEST;

export const isFirebaseConfigured = (): boolean => {
  return !!(
    firebaseConfig.apiKey &&
    firebaseConfig.authDomain &&
    firebaseConfig.projectId
  );
};

let appInstance: FirebaseApp;
let authInstance: ReturnType<typeof getAuth>;
let dbInstance: ReturnType<typeof getFirestore>;
let analyticsInstance: Analytics | null = null;

function createFirebaseAppAndServices() {
  if (appInstance) {
    return { app: appInstance, auth: authInstance, db: dbInstance, analytics: analyticsInstance };
  }

  const existingApps = getApps();
  if (existingApps.length > 0) {
    appInstance = existingApps[0];
  } else {
    const config = {
      apiKey: firebaseConfig.apiKey || (isTestEnv ? 'mock-api-key' : ''),
      authDomain: firebaseConfig.authDomain || (isTestEnv ? 'mock.firebaseapp.com' : ''),
      projectId: firebaseConfig.projectId || (isTestEnv ? 'mock-project' : ''),
      storageBucket: firebaseConfig.storageBucket || (isTestEnv ? 'mock.appspot.com' : ''),
      messagingSenderId: firebaseConfig.messagingSenderId || (isTestEnv ? '123456789' : ''),
      appId: firebaseConfig.appId || (isTestEnv ? '1:123456789:web:mock' : ''),
      measurementId: firebaseConfig.measurementId || undefined,
    };

    if (!config.apiKey || !config.authDomain || !config.projectId) {
      throw new Error('Firebase configuration is incomplete');
    }

    appInstance = initializeApp(config);
  }

  authInstance = getAuth(appInstance);
  dbInstance = getFirestore(appInstance);

  // Initialize Analytics only in browser environment and if supported
  if (typeof window !== 'undefined' && !isTestEnv) {
    isSupported()
      .then((supported) => {
        if (supported && !analyticsInstance) {
          analyticsInstance = getAnalytics(appInstance);
        }
      })
      .catch((error) => {
        console.warn('Firebase Analytics not available:', error);
      });
  }

  if (import.meta.env.DEV && import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true') {
    try {
      connectAuthEmulator(authInstance, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(dbInstance, 'localhost', 8080);
    } catch (error) {
      console.warn('Firebase emulators not available:', error);
    }
  }

  return { app: appInstance, auth: authInstance, db: dbInstance, analytics: analyticsInstance };
}

// Initialize Firebase services
let app: FirebaseApp;
let auth: ReturnType<typeof getAuth>;
let db: ReturnType<typeof getFirestore>;
let analytics: Analytics | null = null;

const services = createFirebaseAppAndServices();
app = services.app;
auth = services.auth;
db = services.db;
analytics = services.analytics;

// Initialize Analytics asynchronously
if (typeof window !== 'undefined' && !isTestEnv) {
  isSupported().then((supported) => {
    if (supported && !analytics) {
      analytics = getAnalytics(app);
    }
  });
}

export { app, auth, db, analytics };
export default app;
```

---

## Step 2: SSO Migration to Firebase

### 2.1 Copy FirebaseSSO Service

Copy `src/services/hub/FirebaseSSO.ts` from the Hub or Trainer app to your Chef app:

**File:** `services/hub/FirebaseSSO.ts`

```typescript
/**
 * Firebase SSO Service
 * Handles SSO authentication via URL-based token exchange with Firebase
 *
 * Flow:
 * 1. Hub generates token and stores in Firestore sso_tokens collection
 * 2. Hub redirects to Chef with ?sso_token=xxx in URL
 * 3. Chef reads token from URL and exchanges it for Firebase ID token
 * 4. Chef uses ID token to authenticate (or exchanges for custom token server-side)
 */

import { db } from '../../src/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export interface FirebaseSSOTokenData {
  user_id: string;
  id_token?: string;
  expires_at: string;
}

/**
 * Gets SSO token from URL parameter
 */
export function getSSOTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('sso_token');
}

/**
 * Exchanges SSO token for Firebase ID token
 *
 * Queries the Firestore sso_tokens collection to retrieve token data,
 * then returns the user_id and ID token.
 *
 * @param token - The SSO token from URL parameter
 * @returns SSO token data with user_id and ID token, or null if exchange fails
 */
export async function exchangeFirebaseSSOToken(
  token: string,
): Promise<FirebaseSSOTokenData | null> {
  try {
    console.log('🔐 FirebaseSSO: Exchanging SSO token...');

    // Query Firestore sso_tokens collection
    const tokenDocRef = doc(db, 'sso_tokens', token);
    const tokenDoc = await getDoc(tokenDocRef);

    if (!tokenDoc.exists()) {
      console.error('🔐 FirebaseSSO: Token not found in Firestore');
      return null;
    }

    const tokenData = tokenDoc.data();

    // Validate required fields
    if (!tokenData.user_id) {
      console.error('🔐 FirebaseSSO: Missing user_id in token data');
      return null;
    }

    // Check if token is expired (tokens expire after 5 minutes)
    const expiresAt = tokenData.expires_at?.toDate?.() || new Date(tokenData.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.error('🔐 FirebaseSSO: Token has expired');
      // Delete expired token
      await deleteDoc(tokenDocRef);
      return null;
    }

    console.log('✅ FirebaseSSO: Token found and valid');

    // Delete the token after successful exchange (one-time use)
    try {
      await deleteDoc(tokenDocRef);
      console.log('🗑️ FirebaseSSO: Token deleted from Firestore');
    } catch (deleteError) {
      console.warn('⚠️ FirebaseSSO: Failed to delete token:', deleteError);
    }

    // Return token data
    return {
      user_id: tokenData.user_id,
      id_token: tokenData.id_token,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('🔐 FirebaseSSO: Error exchanging token:', error);
    return null;
  }
}
```

### 2.2 Create SSO Hook for Chef App

Create `src/hooks/useFirebaseSSOAuth.ts`:

```typescript
import { useState, useEffect, useRef } from 'react';
import { auth } from '../src/lib/firebase';
import { exchangeFirebaseSSOToken, getSSOTokenFromUrl } from '../services/hub/FirebaseSSO';
import { signInWithCustomToken } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface UseFirebaseSSOAuthResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFirebaseSSOAuth(): UseFirebaseSSOAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const tokenProcessedRef = useRef(false);

  useEffect(() => {
    async function initAuth() {
      // Check for existing session first
      const unsubscribe = auth.onAuthStateChanged((currentUser) => {
        if (currentUser && !tokenProcessedRef.current) {
          setUser(currentUser);
          setIsLoading(false);
          tokenProcessedRef.current = true;
        }
      });

      // If no session, check for SSO token
      if (!auth.currentUser) {
        try {
          const token = getSSOTokenFromUrl();
          
          if (token) {
            // Remove token from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('sso_token');
            window.history.replaceState({}, document.title, url.toString());

            // Exchange token for Firebase ID token
            const tokenData = await exchangeFirebaseSSOToken(token);
            
            if (tokenData) {
              console.log('SSO token exchanged, user_id:', tokenData.user_id);
              
              // Note: Firebase Auth doesn't support setting session from ID token on client
              // You'll need to use Firebase Custom Tokens (server-side) or verify the token
              // For now, we'll use the ID token to authenticate
              // In production, implement server-side custom token generation
              
              // TODO: Implement proper Firebase Auth session establishment
              // This may require a server endpoint that verifies the ID token and returns a custom token
              // For now, the user_id is available but we need to establish a Firebase Auth session
              // Option A: Create server endpoint that returns custom token, then use:
              // const customToken = await fetchCustomTokenFromServer(tokenData.id_token);
              // await signInWithCustomToken(auth, customToken);
              
              // Option B: Use ID token for Firestore access (less secure, not recommended for production)
              // The Firestore rules would need to allow access based on the ID token
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err : new Error('SSO authentication failed'));
          console.error('SSO auth error:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }

      return () => unsubscribe();
    }

    initAuth();
  }, []);

  return { user, isLoading, error };
}
```

### 2.3 Update App.tsx to Use Firebase SSO

Replace Supabase SSO with Firebase SSO:

**Before (Supabase):**
```typescript
import { useSchemaBasedSSO } from '@/services/hub/SchemaBasedSSO';
import { supabase } from '@/lib/supabase';

function App() {
  const { user, session, isLoading, error } = useSchemaBasedSSO(supabase);
  // ...
}
```

**After (Firebase):**
```typescript
import { useFirebaseSSOAuth } from '@/hooks/useFirebaseSSOAuth';

function App() {
  const { user, isLoading, error } = useFirebaseSSOAuth();
  // ...
}
```

---

## Step 3: Database Migration to Firestore

### 3.1 Chef App Data Collections

The Chef app typically uses these Supabase tables (now Firestore collections):
- `recipes` - User's saved recipes
- `shopping_list` - Shopping list items
- `meal_plans` - Meal planning data
- `nutrition_logs` - Nutrition tracking data
- `ingredients` - Ingredient database

### 3.2 Update Data Access Layer

Replace Supabase queries with Firestore queries:

#### Example 1: Get User Recipes

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .schema('chef')
  .from('recipes')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false });
```

**After (Firestore):**
```typescript
import { collection, query, where, orderBy, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipesRef = collection(db, 'recipes');
const q = query(
  recipesRef,
  where('user_id', '==', userId),
  orderBy('created_at', 'desc')
);
const querySnapshot = await getDocs(q);
const recipes = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

#### Example 2: Create Recipe

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .schema('chef')
  .from('recipes')
  .insert({
    user_id: userId,
    name: recipeName,
    ingredients: ingredients,
    instructions: instructions,
    created_at: new Date().toISOString()
  })
  .select()
  .single();
```

**After (Firestore):**
```typescript
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipesRef = collection(db, 'recipes');
const docRef = await addDoc(recipesRef, {
  user_id: userId,
  name: recipeName,
  ingredients: ingredients,
  instructions: instructions,
  created_at: serverTimestamp()
});

// Get the created document
const recipe = { id: docRef.id, ...(await getDoc(docRef)).data() };
```

#### Example 3: Update Recipe

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .schema('chef')
  .from('recipes')
  .update({ name: newName })
  .eq('id', recipeId)
  .select()
  .single();
```

**After (Firestore):**
```typescript
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipeRef = doc(db, 'recipes', recipeId);
await updateDoc(recipeRef, {
  name: newName,
  updated_at: serverTimestamp()
});
```

#### Example 4: Delete Recipe

**Before (Supabase):**
```typescript
const { error } = await supabase
  .schema('chef')
  .from('recipes')
  .delete()
  .eq('id', recipeId);
```

**After (Firestore):**
```typescript
import { doc, deleteDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipeRef = doc(db, 'recipes', recipeId);
await deleteDoc(recipeRef);
```

#### Example 5: Shopping List Query

**Before (Supabase):**
```typescript
const { data, error } = await supabase
  .schema('chef')
  .from('shopping_list')
  .select('*')
  .eq('user_id', userId)
  .eq('completed', false);
```

**After (Firestore):**
```typescript
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const shoppingListRef = collection(db, 'shopping_list');
const q = query(
  shoppingListRef,
  where('user_id', '==', userId),
  where('completed', '==', false)
);
const querySnapshot = await getDocs(q);
const items = querySnapshot.docs.map(doc => ({
  id: doc.id,
  ...doc.data()
}));
```

### 3.3 Update Realtime Subscriptions

**Before (Supabase Realtime):**
```typescript
const subscription = supabase
  .channel('recipes')
  .on('postgres_changes', {
    event: '*',
    schema: 'chef',
    table: 'recipes',
    filter: `user_id=eq.${userId}`
  }, handleChange)
  .subscribe();
```

**After (Firestore):**
```typescript
import { onSnapshot, collection, query, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';

const recipesRef = collection(db, 'recipes');
const q = query(recipesRef, where('user_id', '==', userId));

const unsubscribe = onSnapshot(q, (snapshot) => {
  const recipes = snapshot.docs.map(doc => ({
    id: doc.id,
    ...doc.data()
  }));
  handleChange(recipes);
});

// Cleanup: unsubscribe()
```

### 3.4 Update Type Definitions

Create `src/types/firestore.ts` (copy from Hub or Trainer app) and update types to use Firestore `Timestamp` instead of strings for dates:

```typescript
import { Timestamp } from 'firebase/firestore';

export interface Recipe {
  id: string;
  user_id: string;
  name: string;
  ingredients: string[];
  instructions: string[];
  created_at: Timestamp;
  updated_at?: Timestamp;
}

export interface ShoppingListItem {
  id: string;
  user_id: string;
  item: string;
  quantity?: string;
  completed: boolean;
  created_at: Timestamp;
}
```

---

## Step 4: Update Authentication Service

### 4.1 Replace Supabase Auth with Firebase Auth

Update `services/authService.ts` or similar:

**Before (Supabase):**
```typescript
import { supabase } from '@/lib/supabase';

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  });
  return { user: data.user, error };
}

export async function signUp(email: string, password: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password
  });
  return { user: data.user, error };
}

export async function signOut() {
  await supabase.auth.signOut();
}
```

**After (Firebase):**
```typescript
import { auth } from '@/lib/firebase';
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut
} from 'firebase/auth';

export async function signIn(email: string, password: string) {
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}

export async function signUp(email: string, password: string) {
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    return { user: userCredential.user, error: null };
  } catch (error) {
    return { user: null, error };
  }
}

export async function signOut() {
  await firebaseSignOut(auth);
}
```

### 4.2 Update useAuth Hook

Update `hooks/useAuth.ts`:

**Before (Supabase):**
```typescript
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
      }
    );

    return () => subscription.unsubscribe();
  }, []);

  return { user, session, loading };
}
```

**After (Firebase):**
```typescript
import { useEffect, useState } from 'react';
import { auth } from '@/lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  return { user, loading };
}
```

---

## Step 5: Branding Updates

### 5.1 Update App Name

- Search and replace "FitCopilot" with "Sanctuary Health"
- Search and replace "Fitcopilot" with "Sanctuary Health"
- Search and replace "Personal Chef" with "Sanctuary Health Chef" (if applicable)
- Update `package.json` name if needed

### 5.2 Update Color Scheme

Follow the color palette update guide: `docs/migration/HUB_COLOR_PALETTE_UPDATE.md`

Replace all `lime-*`, `amber-*`, or `yellow-*` colors with the custom gold color `#f0dc7a`.

**Quick replacements:**
- `bg-lime-500` → `bg-[#f0dc7a]`
- `text-lime-400` → `text-[#f0dc7a]`
- `hover:bg-lime-400` → `hover:bg-[#f4e59c]`
- `border-lime-500` → `border-[#f0dc7a]`

### 5.3 Update Configuration

Update `src/config/index.ts` or similar:

```typescript
export const APP_NAME = 'Sanctuary Health Chef';
export const HUB_URL = import.meta.env.VITE_HUB_URL || 'http://localhost:5175';
```

---

## Step 6: Remove Supabase Dependencies

### 6.1 Remove Supabase Packages

```bash
npm uninstall @supabase/supabase-js
```

### 6.2 Remove Supabase Files

- Remove `src/lib/supabase.ts` (if exists)
- Remove `src/services/hub/SchemaBasedSSO.ts` (if exists)
- Remove any Supabase-specific utilities

### 6.3 Update Environment Variables

Remove Supabase env vars from `.env.local`:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Step 7: Firestore Security Rules

Ensure Firestore security rules allow Chef app access. Add these rules to `firestore.rules`:

```javascript
// Recipes collection - users can read/write their own recipes
match /recipes/{recipeId} {
  allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
}

// Shopping list collection
match /shopping_list/{itemId} {
  allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
}

// Meal plans collection
match /meal_plans/{planId} {
  allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
}

// Nutrition logs collection
match /nutrition_logs/{logId} {
  allow read: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow create: if isAuthenticated() && request.resource.data.user_id == request.auth.uid;
  allow update: if isAuthenticated() && resource.data.user_id == request.auth.uid;
  allow delete: if isAuthenticated() && resource.data.user_id == request.auth.uid;
}
```

Deploy rules:
```bash
firebase deploy --only firestore:rules
```

---

## Step 8: Testing

### 8.1 Test SSO Flow

1. Start Hub app on `http://localhost:5175`
2. Start Chef app on its configured port (e.g., `http://localhost:3002`)
3. Log in to Hub
4. Navigate to `/chef` route in Hub
5. Verify Chef app receives SSO token and authenticates

### 8.2 Test Data Access

1. Create a recipe in Chef app
2. Verify it appears in Firestore Console
3. Update a recipe
4. Delete a recipe
5. Test shopping list operations
6. Verify Firestore rules allow proper access

### 8.3 Test Realtime Updates

1. Open Chef app in two browser windows
2. Create/update a recipe in one window
3. Verify it updates in real-time in the other window

---

## Step 9: Deployment

### 9.1 Register Chef App in Firebase

1. Go to Firebase Console → Project Settings → Your apps
2. Click "Add app" → Web
3. Register the app (e.g., "Sanctuary Health Chef")
4. Copy the `appId` and update `.env.local`:
   ```bash
   VITE_FIREBASE_APP_ID=1:527662509976:web:YOUR_CHEF_APP_ID
   ```

### 9.2 Update Production URLs

Update production environment variables:

```bash
VITE_HUB_URL=https://sanctuary-health.web.app
VITE_FIREBASE_API_KEY=...
# ... other Firebase config
```

### 9.3 Deploy to Firebase Hosting

```bash
# Initialize Firebase (if not already done)
firebase init hosting

# Build the app
npm run build

# Deploy
firebase deploy --only hosting
```

---

## Important Notes

### Firebase Custom Tokens (Production)

The current `exchangeFirebaseSSOToken` implementation returns an ID token, but Firebase Auth on the client side doesn't support setting a session from an ID token directly. For production, you should:

1. **Option A (Recommended)**: Create a server endpoint that:
   - Receives the SSO token
   - Verifies it server-side using Firebase Admin SDK
   - Generates a Firebase Custom Token
   - Returns the custom token to the client
   - Client uses `signInWithCustomToken(auth, customToken)`

2. **Option B**: Use the ID token to verify user identity and grant access to Firestore, but don't establish a full Firebase Auth session (less secure, not recommended for production)

### SSO Token Flow

1. Hub generates token → Stores in Firestore `sso_tokens` collection with `target_app: 'chef'`
2. Hub redirects to Chef → Token in URL (`?sso_token=xxx`)
3. Chef reads token from URL → Calls `exchangeFirebaseSSOToken()`
4. Chef gets Firebase ID token → Uses to authenticate (or exchanges for custom token)

### Data Migration from Supabase

If you have existing data in Supabase, you'll need to migrate it to Firestore:

1. Export data from Supabase (using Supabase CLI or SQL queries)
2. Transform data to Firestore format (convert dates to Timestamps, etc.)
3. Import to Firestore (using Firebase Admin SDK or Firestore import tool)

---

## Troubleshooting

### SSO Token Not Working

- Verify Firebase configuration matches Hub
- Check Firestore `sso_tokens` collection exists
- Verify token hasn't expired (5 minute expiration)
- Check browser console for errors
- Verify Hub is generating tokens with `target_app: 'chef'`

### Firestore Permission Denied

- Verify Firestore security rules are deployed
- Check user is authenticated (`request.auth != null`)
- Verify `user_id` field matches `request.auth.uid`
- Check Firestore Console for rule violations

### Authentication Not Persisting

- Check Firebase Auth persistence settings
- Verify `onAuthStateChanged` listener is set up correctly
- Check browser localStorage for Firebase Auth tokens

### Data Not Appearing

- Verify Firestore collections are created
- Check Firestore Console to see if data is being written
- Verify Firestore rules allow read/write access
- Check browser console for errors

---

## Next Steps

After completing this migration:

1. Test thoroughly in development
2. Migrate data from Supabase to Firestore (if needed)
3. Update color scheme to match Trainer app (gold #f0dc7a)
4. Deploy to production
5. Monitor for errors and performance issues

---

## Reference Files from Hub/Trainer

Copy these files from the Hub or Trainer app to Chef app:
- `src/lib/firebase.ts` - Firebase initialization
- `src/services/hub/FirebaseSSO.ts` - SSO service
- `src/types/firestore.ts` - Firestore type definitions (adapt for Chef data structures)
- `firestore.rules` - Security rules (merge with existing)

---

## Support

If you encounter issues:
1. Check Firebase Console for errors
2. Review Firestore security rules
3. Verify environment variables are set correctly
4. Check browser console and network tab for errors
5. Compare implementation with Trainer app (should be very similar)

---

## Checklist

Use this checklist to track your migration progress:

- [ ] Firebase dependencies installed
- [ ] Firebase configuration added to `.env.local`
- [ ] `src/lib/firebase.ts` created
- [ ] `services/hub/FirebaseSSO.ts` copied
- [ ] `hooks/useFirebaseSSOAuth.ts` created
- [ ] `App.tsx` updated to use Firebase SSO
- [ ] All Supabase queries replaced with Firestore queries
- [ ] Realtime subscriptions updated to Firestore `onSnapshot`
- [ ] Type definitions updated for Firestore
- [ ] Authentication service updated to Firebase Auth
- [ ] `useAuth` hook updated
- [ ] Branding updated (FitCopilot → Sanctuary Health)
- [ ] Color scheme updated to gold (#f0dc7a)
- [ ] Supabase packages removed
- [ ] Supabase files removed
- [ ] Environment variables updated
- [ ] Firestore security rules added and deployed
- [ ] SSO flow tested
- [ ] Data access tested
- [ ] Realtime updates tested
- [ ] Chef app registered in Firebase Console
- [ ] Production environment variables updated
- [ ] App deployed to Firebase Hosting

