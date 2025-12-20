# Chef App Migration Checklist

Quick reference checklist for migrating FitCopilot Chef app to Sanctuary Health Chef app. For detailed instructions and code examples, see [CHEF_FIREBASE_MIGRATION_GUIDE.md](./CHEF_FIREBASE_MIGRATION_GUIDE.md).

---

## Prerequisites

- [ ] Copied FitCopilot Chef app codebase
- [ ] Firebase project `sanctuary-health` already set up (from Hub migration)
- [ ] Firebase CLI installed (`npm install -g firebase-tools`)
- [ ] Node.js and npm installed

---

## Step 1: Firebase Setup

- [ ] Install Firebase dependencies (`npm install firebase`)
- [ ] Add Firebase configuration to `.env.local` (copy from Hub/Trainer app)
- [ ] Create `src/lib/firebase.ts` (copy from Hub/Trainer app)
- [ ] Verify Firebase initialization works

---

## Step 2: SSO Migration to Firebase

- [ ] Copy `src/services/hub/FirebaseSSO.ts` from Hub/Trainer app
- [ ] Create `src/hooks/useFirebaseSSOAuth.ts` hook
- [ ] Update `App.tsx` to use `useFirebaseSSOAuth` instead of Supabase SSO
- [ ] Remove Supabase SSO imports and usage
- [ ] **Note**: SSO requires server-side custom token generation for production (see Critical Notes below)

---

## Step 3: Database Migration to Firestore

- [ ] Replace Supabase queries with Firestore queries in data access layer
- [ ] Update recipes collection queries
- [ ] Update shopping_list collection queries
- [ ] Update meal_plans collection queries (if applicable)
- [ ] Update nutrition_logs collection queries (if applicable)
- [ ] Update Realtime subscriptions to use Firestore `onSnapshot`
- [ ] Create `src/types/firestore.ts` (copy from Hub/Trainer app, adapt for Chef data)
- [ ] Update type definitions to use Firestore `Timestamp` instead of strings
- [ ] Test all data read/write operations

---

## Step 4: Authentication Service Migration

- [ ] Update `services/authService.ts` to use Firebase Auth
- [ ] Replace `supabase.auth.signInWithPassword` with `signInWithEmailAndPassword`
- [ ] Replace `supabase.auth.signUp` with `createUserWithEmailAndPassword`
- [ ] Replace `supabase.auth.signOut` with Firebase `signOut`
- [ ] Update `hooks/useAuth.ts` to use Firebase `onAuthStateChanged`
- [ ] Remove Supabase Auth dependencies

---

## Step 5: Branding Updates

- [ ] Search and replace "FitCopilot" with "Sanctuary Health"
- [ ] Search and replace "Fitcopilot" with "Sanctuary Health"
- [ ] Search and replace "Personal Chef" with "Sanctuary Health Chef" (if applicable)
- [ ] Update `package.json` name if needed
- [ ] Update internal routes referencing FitCopilot (if any)
- [ ] Update `src/config/index.ts` with new app name and Hub URL

---

## Step 6: Color Scheme Update

- [ ] Replace all `lime-*` colors with custom gold `#f0dc7a`
- [ ] Replace all `amber-*` colors with custom gold `#f0dc7a`
- [ ] Replace all `yellow-*` colors with custom gold shades
- [ ] Update hover states to lighter gold `#f4e59c`
- [ ] Update gradients to use gold color scheme
- [ ] See [HUB_COLOR_PALETTE_UPDATE.md](./HUB_COLOR_PALETTE_UPDATE.md) for details

---

## Step 7: Remove Supabase Dependencies

- [ ] Uninstall Supabase packages (`npm uninstall @supabase/supabase-js`)
- [ ] Remove `src/lib/supabase.ts` (if exists)
- [ ] Remove `src/services/hub/SchemaBasedSSO.ts` (if exists)
- [ ] Remove any Supabase-specific utilities
- [ ] Remove Supabase env vars from `.env.local`:
  - [ ] `VITE_SUPABASE_URL`
  - [ ] `VITE_SUPABASE_ANON_KEY`
  - [ ] `VITE_SUPABASE_PUBLISHABLE_KEY`

---

## Step 8: Firestore Security Rules

- [ ] Add recipes collection rules to `firestore.rules`
- [ ] Add shopping_list collection rules
- [ ] Add meal_plans collection rules (if applicable)
- [ ] Add nutrition_logs collection rules (if applicable)
- [ ] Test rules allow authenticated users to read/write their own data
- [ ] Deploy updated rules (`firebase deploy --only firestore:rules`)

---

## Step 9: Testing

- [ ] Test SSO flow:
  - [ ] Start Hub app on `http://localhost:5175`
  - [ ] Start Chef app on configured port
  - [ ] Log in to Hub
  - [ ] Navigate to `/chef` route in Hub
  - [ ] Verify Chef app receives SSO token and authenticates
- [ ] Test data access:
  - [ ] Create a recipe in Chef app
  - [ ] Verify it appears in Firestore Console
  - [ ] Update a recipe
  - [ ] Delete a recipe
  - [ ] Test shopping list operations
  - [ ] Verify Firestore rules allow proper access
- [ ] Test realtime updates:
  - [ ] Open Chef app in two browser windows
  - [ ] Create/update a recipe in one window
  - [ ] Verify it updates in real-time in the other window

---

## Step 10: Deployment

- [ ] Register Chef app in Firebase Console (get unique `appId`)
- [ ] Update `.env.local` with Chef app's `VITE_FIREBASE_APP_ID`
- [ ] Update production environment variables:
  - [ ] `VITE_HUB_URL=https://sanctuary-health.web.app`
  - [ ] All Firebase config variables
- [ ] Build production bundle (`npm run build`)
- [ ] Initialize Firebase Hosting (`firebase init hosting`)
- [ ] Deploy to Firebase Hosting (`firebase deploy --only hosting`)

---

## Critical Notes

### SSO Custom Token Limitation

Firebase Auth doesn't support setting a session from an ID token on the client side. The current `exchangeFirebaseSSOToken` implementation returns an ID token, but for production you need one of these options:

**Option A (Recommended)**: Create a server endpoint that:
- Receives the SSO token
- Verifies it server-side using Firebase Admin SDK
- Generates a Firebase Custom Token
- Returns the custom token to the client
- Client uses `signInWithCustomToken(auth, customToken)`

**Option B (Not Recommended)**: Use the ID token to verify user identity and grant access to Firestore, but don't establish a full Firebase Auth session (less secure).

### SSO Token Flow

1. Hub generates token → Stores in Firestore `sso_tokens` collection with `target_app: 'chef'`
2. Hub redirects to Chef → Token in URL (`?sso_token=xxx`)
3. Chef reads token from URL → Calls `exchangeFirebaseSSOToken()`
4. Chef gets Firebase ID token → Uses to authenticate (or exchanges for custom token)

### Data Migration

If you have existing data in Supabase:
- [ ] Export data from Supabase
- [ ] Transform data to Firestore format (dates to Timestamps, etc.)
- [ ] Import to Firestore

---

## Reference Files from Hub/Trainer

Copy these files from the Hub or Trainer app to Chef app:

- [ ] `src/lib/firebase.ts` - Firebase initialization
- [ ] `src/services/hub/FirebaseSSO.ts` - SSO service
- [ ] `src/types/firestore.ts` - Firestore type definitions (adapt for Chef)
- [ ] `firestore.rules` - Security rules (merge with existing)

---

## Troubleshooting Quick Reference

- **SSO Token Not Working**: Verify Firebase config matches Hub, check `sso_tokens` collection exists, verify token hasn't expired (5 min), check browser console, verify Hub generates tokens with `target_app: 'chef'`
- **Firestore Permission Denied**: Verify security rules deployed, check user authenticated, verify `user_id` matches `request.auth.uid`
- **Authentication Not Persisting**: Check Firebase Auth persistence settings, verify `onAuthStateChanged` listener, check browser localStorage
- **Data Not Appearing**: Verify Firestore collections exist, check Firestore Console, verify rules allow access

For detailed troubleshooting, see [CHEF_FIREBASE_MIGRATION_GUIDE.md](./CHEF_FIREBASE_MIGRATION_GUIDE.md).

