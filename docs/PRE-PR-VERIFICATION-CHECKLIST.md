# Pre-PR Verification Checklist - FitCopilot Chef

Use this checklist before creating a pull request to ensure code quality and prevent common issues.

## Pre-Commit Checks (Recommended)

Run these checks before committing:

- [ ] Code passes type checking (`npm run type-check`)
- [ ] No TypeScript errors or warnings
- [ ] Build succeeds (`npm run build`)

## Manual Pre-PR Checklist

Before creating a PR, manually verify:

### Code Quality

- [ ] Code follows project style guidelines
- [ ] Console.log statements are intentional and useful (or removed)
- [ ] No commented-out code blocks
- [ ] No TODO comments without issue references
- [ ] All imports are used and organized
- [ ] No unused variables or functions

### Type Safety

- [ ] TypeScript compiles without errors (`npm run type-check`)
- [ ] No `any` types (use proper types or `unknown`)
- [ ] All function parameters and return types are typed
- [ ] Supabase queries use proper schema specification (`.schema('chef')` or `.schema('public')`)

### Security

- [ ] No hardcoded API keys (use environment variables)
- [ ] Gemini API key uses `import.meta.env.VITE_GEMINI_API_KEY`
- [ ] Supabase credentials use environment variables
- [ ] No sensitive data in commit history
- [ ] `.env.local` is in `.gitignore` (never committed)

### Build & Deployment

- [ ] Project builds successfully (`npm run build`)
- [ ] No build warnings or errors
- [ ] Preview build works (`npm run preview` after build)
- [ ] All environment variables documented in README

### Database Schema

- [ ] Chef-specific tables use `.schema('chef')`:
  - [ ] `recipes`
  - [ ] `recipe_content`
  - [ ] `recipe_ingredients`
  - [ ] `canonical_ingredients`
  - [ ] `shopping_list`
  - [ ] `user_inventory`
  - [ ] `locations`
- [ ] Shared tables use `.schema('public')`:
  - [ ] `user_profiles`
- [ ] RLS policies are respected (queries handle permission errors)

### Chef App Specific Features

#### Recipe Management
- [ ] Recipe creation works correctly
- [ ] Recipe editing saves properly
- [ ] Recipe deletion removes all related data
- [ ] Recipe favorites toggle works
- [ ] Recipe search/filtering functions correctly

#### AI Chef Integration
- [ ] All 7 AI chefs register on app load
- [ ] Console shows: "✅ Successfully registered 7 AI chef(s)"
- [ ] Chef selection UI displays all personas
- [ ] Recipe generation uses selected chef's system prompt
- [ ] Gemini API errors are handled gracefully

#### Shopping & Inventory
- [ ] Shopping list add/remove works
- [ ] Shopping list items can be checked/unchecked
- [ ] User inventory updates correctly
- [ ] Ingredient quantities calculate properly
- [ ] Storage locations can be assigned

#### Profile Synchronization
- [ ] User profile loads from `public.user_profiles`
- [ ] Profile changes save to correct schema
- [ ] JSONB fields (`fitness_goals`, `preferred_units`) map correctly
- [ ] User ID matches across Hub/Trainer/Chef apps

#### Authentication
- [ ] Login works correctly
- [ ] Logout clears session
- [ ] Account page displays User ID, email, timestamps
- [ ] Session persists across page refreshes
- [ ] Auth errors are handled gracefully

### Documentation

- [ ] Code changes are documented (comments for complex logic)
- [ ] New features documented in README or docs folder
- [ ] Breaking changes clearly documented
- [ ] Environment variables documented
- [ ] Database schema changes documented

### UI/UX Testing

#### Desktop (>768px)
- [ ] Navigation header displays correctly
- [ ] All pages render without layout issues
- [ ] Buttons and inputs are properly sized
- [ ] Cards and modals display correctly
- [ ] Recipe grid layout works

#### Mobile (<768px)
- [ ] Bottom navigation bar displays
- [ ] Header stays at top (not bottom)
- [ ] Touch targets are adequately sized
- [ ] Forms are usable on mobile
- [ ] Modals fit mobile screens

#### Dark Theme
- [ ] All text is readable (proper contrast)
- [ ] Lime-500 accent color used consistently
- [ ] Background colors match design (slate-800, slate-900)
- [ ] Borders visible (slate-700)

### Cross-App Integration

- [ ] User ID matches Hub app User ID
- [ ] User ID matches Trainer app User ID
- [ ] Shared Supabase database (`tknkxfeyftgeicuosrhi`)
- [ ] Chef schema tables isolated from other apps
- [ ] Public schema shared correctly

## Quick Verification Commands

Run these commands before creating a PR:

```bash
# Type check (most important)
npm run type-check

# Build check
npm run build

# Quick verification (type check + build)
npm run verify:quick

# Full verification
npm run verify

# Preview production build
npm run build && npm run preview
```

## Manual Testing Checklist

Since the Chef app doesn't have automated tests yet, perform these manual tests:

### Critical Path Tests

1. **Authentication Flow**
   - [ ] Can sign up with new account
   - [ ] Can sign in with existing account
   - [ ] Can sign out
   - [ ] Session persists on refresh

2. **Recipe Generation (AI Chef)**
   - [ ] Select an AI chef persona
   - [ ] Generate a recipe with preferences
   - [ ] Recipe displays with all sections
   - [ ] Recipe saves to database
   - [ ] Generated recipe appears in recipes list

3. **Recipe Management**
   - [ ] View recipes list
   - [ ] Create new manual recipe
   - [ ] Edit existing recipe
   - [ ] Delete recipe
   - [ ] Mark recipe as favorite

4. **Shopping List**
   - [ ] Add ingredient to shopping list
   - [ ] Check/uncheck items
   - [ ] Remove items
   - [ ] List persists across sessions

5. **User Inventory**
   - [ ] Add item to inventory
   - [ ] Update quantities
   - [ ] Assign storage locations
   - [ ] Remove items

6. **Profile Settings**
   - [ ] Update dietary restrictions
   - [ ] Update preferred units
   - [ ] Update fitness goals
   - [ ] Changes save and persist

7. **Account Page**
   - [ ] Account Information card displays
   - [ ] Email shown correctly
   - [ ] User ID displayed
   - [ ] Account created date shown
   - [ ] Last sign in timestamp shown
   - [ ] Shows "App: FitCopilot Chef"
   - [ ] Shows "Database: Shared (chef schema)"

## Common Issues to Avoid

### TypeScript Errors
```bash
# Check for type errors before committing
npm run type-check
```

### Build Failures
```bash
# Verify build works
npm run build

# Common build issues:
# - Missing environment variables
# - Import path errors
# - Type errors
# - Missing dependencies
```

### Schema Errors
```typescript
// ❌ WRONG - Will fail with 406 error
await supabase.from('recipes').select('*')

// ✅ CORRECT - Specify chef schema
await supabase.schema('chef').from('recipes').select('*')

// ✅ CORRECT - Public schema for profiles
await supabase.schema('public').from('user_profiles').select('*')
```

### Environment Variables
```bash
# Ensure .env.local has:
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_anon_key_here
VITE_GEMINI_API_KEY=your_gemini_api_key_here

# ❌ Don't commit .env.local to git!
# ✅ Do document required variables in README
```

### AI Chef Registration
```typescript
// Console should show on app load:
// 🔑 Gemini API key found, registering AI chefs...
// ✅ Registered Sports Nutritionist (ID: gemini-nutritionist)
// ... (all 7 chefs)
// ✅ Successfully registered 7 AI chef(s)

// ❌ If you see: "⚠️ Gemini API key not found"
// → Check .env.local has VITE_GEMINI_API_KEY
```

## Database Verification

Before pushing, verify database queries:

```bash
# Check console for these success messages:
# ✅ Supabase initialized (Multi-Schema): https://tknkxfeyftgeicuosrhi.supabase.co
# ✅ Using chef schema for all recipe data

# Should NOT see:
# ❌ 406 (Not Acceptable)
# ❌ PGRST106 - schema must be public, graphql_public
# ❌ PGRST205 - Could not find table
```

## Cross-App Sync Verification

### Before Pushing, Verify User Sync

1. **Start all three apps:**
   ```bash
   # Hub (port 5175)
   cd "Local Sites/Workout Generator App"
   npm run dev -- --port 5175
   
   # Trainer (port 3001)
   cd "Local Sites/Fitcopilot Trainer"
   npm run dev -- --port 3001
   
   # Chef (port 3002)
   cd "Local Sites/Fitcopilot Chef"
   npm run dev
   ```

2. **Sign in to all three apps** with the same account

3. **Verify User IDs match:**
   - Hub: http://localhost:5175/account → Copy User ID
   - Trainer: http://localhost:3001/account → Copy User ID
   - Chef: http://localhost:3002/account → Copy User ID
   - ✅ All three should be **IDENTICAL**

4. **If User IDs don't match:**
   - ❌ Authentication is not synced
   - Check Supabase URL and anon key in all `.env.local` files
   - Verify all apps use same database: `tknkxfeyftgeicuosrhi.supabase.co`

## Success Criteria

Your PR is ready when:

- ✅ TypeScript compiles without errors (`npm run type-check`)
- ✅ Build succeeds without warnings (`npm run build`)
- ✅ All manual tests pass (see checklist above)
- ✅ Database schema correctly specified in all queries
- ✅ AI chefs register successfully (7 total)
- ✅ User ID matches across Hub/Trainer/Chef apps
- ✅ No hardcoded secrets or API keys
- ✅ No console errors in browser
- ✅ Mobile and desktop layouts work correctly
- ✅ Account Information card displays correctly
- ✅ Documentation updated for any new features

## Pre-Push Checklist

Quick final check before pushing:

```bash
# 1. Type check
npm run type-check
# Expected: No errors

# 2. Build check
npm run build
# Expected: Build completes successfully

# 3. Start dev server
npm run dev
# Expected: Server starts on port 3002

# 4. Open browser
open http://localhost:3002

# 5. Manual verification:
# - Sign in works
# - Account page shows User ID
# - AI chefs registered (check console)
# - Can generate a recipe
# - No console errors
```

## Getting Help

If verification fails:

1. Check the error message carefully
2. Review documentation in `/docs` folder
3. Check Supabase dashboard for schema/RLS issues
4. Verify environment variables in `.env.local`
5. Compare with Hub/Trainer implementations
6. Ask for help in team communication channel

## Deployment Notes

### Before Deploying to Production

- [ ] Verify all environment variables set in Vercel/hosting platform
- [ ] Test with production Supabase database
- [ ] Verify Gemini API key is valid and has quota
- [ ] Check RLS policies are enabled on all chef schema tables
- [ ] Verify CORS settings for production domain
- [ ] Test authentication flow in production
- [ ] Verify all 7 AI chefs register in production

### Environment Variables for Production

Required in Vercel/hosting platform:

```bash
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=your_production_anon_key
VITE_GEMINI_API_KEY=your_production_gemini_key
```

## Additional Resources

- **Multi-Schema Architecture:** See `MIGRATION-COMPLETE.md`
- **AI Chef System:** See `AI-CHEF-SYSTEM.md`
- **Database Schema:** See `SCHEMA-REFERENCE.md`
- **Profile Synchronization:** See `PROFILE-TABLE-FIX-APPLIED.md`
- **Account Information:** See `ACCOUNT-INFO-IMPLEMENTED.md`

---

*Last Updated: December 4, 2025*  
*App: FitCopilot Chef*  
*Database: Shared (chef schema)*
