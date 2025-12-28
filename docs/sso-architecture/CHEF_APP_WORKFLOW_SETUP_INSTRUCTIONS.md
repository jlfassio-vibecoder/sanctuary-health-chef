# Chef App - Firebase Hosting GitHub Actions Setup Instructions

## Instructions for AI Agent

Set up Firebase Hosting with GitHub Actions for the chef app, replicating the exact configuration from the trainer app. All GitHub secrets have already been added to the repository.

## Prerequisites

- All GitHub secrets are already added (same as trainer app)
- Firebase project: `sanctuary-health` (shared with Hub, Trainer, Chef)
- Site ID: `sanctuary-health-chef` (auto-detected from `firebase.json`)
- Service account: `FIREBASE_SERVICE_ACCOUNT_SANCTUARY_HEALTH` (shared secret)

## Step 1: Verify firebase.json Configuration

Ensure `firebase.json` exists and has the correct site ID:

```json
{
  "hosting": {
    "site": "sanctuary-health-chef",
    "public": "dist",
    ...
  }
}
```

## Step 2: Create GitHub Workflows Directory

Create `.github/workflows/` directory if it doesn't exist.

## Step 3: Create Production Deployment Workflow

Create `.github/workflows/firebase-hosting-merge.yml` with this exact content:

```yaml
name: Deploy to Firebase Hosting on merge

on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      checks: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '23'
          cache: 'npm'
      - name: Clean install dependencies
        run: |
          rm -rf node_modules package-lock.json
          npm install
      - name: Build
        run: npm run build
        env:
          NODE_OPTIONS: '--max-old-space-size=4096'
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
          VITE_HUB_URL: ${{ secrets.VITE_HUB_URL }}
          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}
      - name: Deploy to Firebase Hosting
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SANCTUARY_HEALTH }}'
          channelId: live
          projectId: sanctuary-health
```

## Step 4: Create Preview Deployment Workflow

Create `.github/workflows/firebase-hosting-pull-request.yml` with this exact content:

```yaml
name: Deploy to Firebase Hosting on PR

on:
  pull_request:
    branches:
      - main

jobs:
  build_and_preview:
    runs-on: ubuntu-latest
    permissions:
      contents: write
      pull-requests: write
      checks: write
      id-token: write
    steps:
      - uses: actions/checkout@v4
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '23'
          cache: 'npm'
      - name: Clean install dependencies
        run: |
          rm -rf node_modules package-lock.json
          npm install
      - name: Build
        run: npm run build
        env:
          NODE_OPTIONS: '--max-old-space-size=4096'
          VITE_FIREBASE_API_KEY: ${{ secrets.VITE_FIREBASE_API_KEY }}
          VITE_FIREBASE_AUTH_DOMAIN: ${{ secrets.VITE_FIREBASE_AUTH_DOMAIN }}
          VITE_FIREBASE_PROJECT_ID: ${{ secrets.VITE_FIREBASE_PROJECT_ID }}
          VITE_FIREBASE_STORAGE_BUCKET: ${{ secrets.VITE_FIREBASE_STORAGE_BUCKET }}
          VITE_FIREBASE_MESSAGING_SENDER_ID: ${{ secrets.VITE_FIREBASE_MESSAGING_SENDER_ID }}
          VITE_FIREBASE_APP_ID: ${{ secrets.VITE_FIREBASE_APP_ID }}
          VITE_FIREBASE_MEASUREMENT_ID: ${{ secrets.VITE_FIREBASE_MEASUREMENT_ID }}
          VITE_HUB_URL: ${{ secrets.VITE_HUB_URL }}
          VITE_GEMINI_API_KEY: ${{ secrets.VITE_GEMINI_API_KEY }}
      - name: Deploy to Firebase Hosting Preview Channel
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_SANCTUARY_HEALTH }}'
          projectId: sanctuary-health
```

## Step 5: Key Configuration Details

### Critical Points:

1. **Site ID**: Automatically detected from `firebase.json` (should be `sanctuary-health-chef`)
   - **DO NOT** add `siteId` parameter - it's not supported
   - The action reads from `firebase.json` automatically

2. **Clean Install Step**: 
   - Uses `rm -rf node_modules package-lock.json && npm install`
   - This fixes the Rollup optional dependency issue (`@rollup/rollup-linux-x64-gnu`)
   - **DO NOT** use `npm ci` - it doesn't properly fetch optional dependencies

3. **Environment Variables in Build Step**:
   - All 9 `VITE_*` secrets must be included in the build `env:` section
   - This includes: 7 Firebase vars + `VITE_HUB_URL` + `VITE_GEMINI_API_KEY`
   - Vite needs these at build time to embed them in the production bundle

4. **Service Account**: 
   - Uses `FIREBASE_SERVICE_ACCOUNT_SANCTUARY_HEALTH` (shared secret)
   - Already exists in repository

5. **Project ID**: 
   - Always `sanctuary-health` (all apps share the same Firebase project)

## Step 6: Verification Checklist

After creating the workflows, verify:

- [ ] `.github/workflows/firebase-hosting-merge.yml` exists and matches exactly
- [ ] `.github/workflows/firebase-hosting-pull-request.yml` exists and matches exactly
- [ ] Both workflows use clean install (not `npm ci`)
- [ ] Both workflows include all 9 environment variables in build step
- [ ] No `siteId` parameter in either workflow
- [ ] `firebase.json` has correct site ID: `sanctuary-health-chef`
- [ ] Permissions include: `contents: write`, `checks: write`, `id-token: write`
- [ ] PR workflow also includes: `pull-requests: write`

## Step 7: Common Issues to Avoid

- ❌ **Don't add `siteId` parameter** - Not supported, reads from `firebase.json` automatically
- ❌ **Don't use `npm ci`** - Doesn't fetch optional dependencies, causes Rollup errors
- ❌ **Don't omit environment variables** - All 9 `VITE_*` secrets must be in build step
- ✅ **Use clean install** - `rm -rf node_modules package-lock.json && npm install`
- ✅ **Include all permissions** - `contents: write`, `checks: write`, `id-token: write`
- ✅ **PR workflow needs** - `pull-requests: write` permission

## Step 8: Differences from Trainer App

The only difference is the **site ID**:
- Trainer app: `sanctuary-health-trainer`
- Chef app: `sanctuary-health-chef`

Everything else is identical:
- Same Firebase project (`sanctuary-health`)
- Same service account secret
- Same environment variables
- Same workflow structure
- Same clean install approach

## Step 9: Test and Commit

1. Create a branch: `chore/setup-firebase-hosting-github`
2. Add the two workflow files
3. Commit with message: `chore: add Firebase Hosting GitHub Actions workflows`
4. Push to remote
5. Create a pull request to test preview deployment
6. After merge, verify production deployment works

## Reference

- Trainer app implementation: `.github/workflows/firebase-hosting-*.yml` in trainer app repository
- Setup guide: `docs/sso-architecture/TRAINER_APP_FIREBASE_HOSTING_SETUP.md` in trainer app repository

## Summary

Create two workflow files with the exact content provided above. The workflows are identical to the trainer app except for the site ID which is auto-detected from `firebase.json`. All secrets are already configured in the repository.

