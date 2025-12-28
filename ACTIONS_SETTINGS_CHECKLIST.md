# GitHub Actions Settings Configuration

## Repository Settings → Actions → General

### Workflow permissions
**Must be set to:**
- ✅ "Read and write permissions" (not "Read repository contents and packages permissions")
- ✅ Check box: "Allow GitHub Actions to create and approve pull requests"

### Actions
- ✅ "Allow all actions and reusable workflows"
- OR "Allow local actions and reusable workflows" (if you want to restrict)

### Workflow runs
- ✅ No restrictions needed (default is fine)

### Artifact and log retention
- Default settings are fine

### Fork pull request workflows
- Not relevant for your use case (you're not using forks)

### Required secrets
All 10 secrets must be under "Repository secrets" (not "Environment secrets"):
1. VITE_FIREBASE_API_KEY
2. VITE_FIREBASE_AUTH_DOMAIN
3. VITE_FIREBASE_PROJECT_ID
4. VITE_FIREBASE_STORAGE_BUCKET
5. VITE_FIREBASE_MESSAGING_SENDER_ID
6. VITE_FIREBASE_APP_ID
7. VITE_FIREBASE_MEASUREMENT_ID
8. VITE_HUB_URL
9. VITE_GEMINI_API_KEY
10. FIREBASE_SERVICE_ACCOUNT_SANCTUARY_HEALTH
