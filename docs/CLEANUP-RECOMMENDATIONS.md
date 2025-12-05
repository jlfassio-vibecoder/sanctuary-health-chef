# Cleanup Recommendations

**Date:** December 5, 2025  
**Purpose:** Organize repository documentation before PR

---

## 📁 Root Directory Cleanup

There are 23 untracked markdown files in the root directory. These appear to be progress documentation from previous work sessions.

### Recommended Actions

#### 1. Keep in `/docs` folder (Already Organized) ✅
These files are properly located:
- `docs/PRE-PR-VERIFICATION-CHECKLIST.md`
- `docs/PR-VERIFICATION-RESULTS.md` (newly created)
- `docs/CLEANUP-RECOMMENDATIONS.md` (this file)

#### 2. Move to `/docs` folder (If Needed)
Consider moving these important reference documents:

**Schema & Database:**
```bash
mv DATABASE-SCHEMA-INFO.md docs/
mv SCHEMA-REFERENCE.md docs/
```

**Migration Guides:**
```bash
mv CHEF_APP_DATABASE_MIGRATION_GUIDE.md docs/
mv MIGRATION-COMPLETE.md docs/
```

**System Documentation:**
```bash
mv AI-CHEF-SYSTEM.md docs/
```

#### 3. Archive or Delete (Temporary Progress Docs)
These appear to be temporary progress markers and can likely be deleted:

**Status Files (Delete):**
- `406-ERROR-RESOLVED.md`
- `DATABASE-CONSTRAINT-FIX.md`
- `DATABASE-MAPPING-FIX-COMPLETE.md`
- `FINAL-PR-STATUS.md`
- `PR-READY.md`
- `PRE-PR-CHECKLIST-READY.md`
- `SCHEMA-FIELD-NAMES-FIXED.md`
- `SCHEMA-MIGRATION-COMPLETE.md`
- `SCHEMA-PERMISSIONS-FIXED.md`
- `SETUP-COMPLETE.md`
- `SHOPPING-LIST-FIX.md`
- `SSO-CLEANUP-COMPLETE.md`
- `SSO-READY.md`

**Feature Implementation Logs (Delete):**
- `ACCOUNT-INFO-IMPLEMENTED.md`
- `CREDENTIALS-UPDATED.md`
- `PROFILE-TABLE-FIX-APPLIED.md`
- `RECIPE-CONTENT-SCHEMA-FIX.md`

#### 4. Review Assets Folder
```
assets/
└── browser-screenshot-a9dc731b-dceb-43c1-8e74-bcf5af4d8c68.png
```

**Options:**
- Keep if referenced in documentation
- Delete if temporary screenshot
- Move to `/docs/images` if needed for documentation

---

## 🧹 Cleanup Commands

### Option A: Delete All Temporary Status Files
```bash
cd "/Users/justinfassio/Local Sites/Fitcopilot Chef"

# Delete temporary status/progress files
rm 406-ERROR-RESOLVED.md \
   ACCOUNT-INFO-IMPLEMENTED.md \
   CREDENTIALS-UPDATED.md \
   DATABASE-CONSTRAINT-FIX.md \
   DATABASE-MAPPING-FIX-COMPLETE.md \
   FINAL-PR-STATUS.md \
   PR-READY.md \
   PRE-PR-CHECKLIST-READY.md \
   PROFILE-TABLE-FIX-APPLIED.md \
   RECIPE-CONTENT-SCHEMA-FIX.md \
   SCHEMA-FIELD-NAMES-FIXED.md \
   SCHEMA-MIGRATION-COMPLETE.md \
   SCHEMA-PERMISSIONS-FIXED.md \
   SETUP-COMPLETE.md \
   SHOPPING-LIST-FIX.md \
   SSO-CLEANUP-COMPLETE.md \
   SSO-READY.md
```

### Option B: Move Important Docs to `/docs` First
```bash
cd "/Users/justinfassio/Local Sites/Fitcopilot Chef"

# Move important reference docs
mv AI-CHEF-SYSTEM.md docs/
mv DATABASE-SCHEMA-INFO.md docs/
mv SCHEMA-REFERENCE.md docs/
mv CHEF_APP_DATABASE_MIGRATION_GUIDE.md docs/
mv MIGRATION-COMPLETE.md docs/

# Then delete temporary files (same as Option A)
```

### Option C: Archive Everything (Safe Option)
```bash
cd "/Users/justinfassio/Local Sites/Fitcopilot Chef"

# Create archive folder
mkdir -p docs/archive/2025-12-05

# Move all root docs to archive
mv *.md docs/archive/2025-12-05/
mv assets docs/archive/2025-12-05/

# Move back the README
mv docs/archive/2025-12-05/README.md ./
```

---

## 📋 Git Status After Cleanup

After cleanup, `git status` should show:
```
On branch chore/database-field-mapping-fix
Changes not staged for commit:
  modified:   components/KitchenManager.tsx
  modified:   components/ShoppingAuditModal.tsx
  modified:   services/dbService.ts
  modified:   types.ts

Untracked files:
  docs/CLEANUP-RECOMMENDATIONS.md
  docs/PR-VERIFICATION-RESULTS.md
```

Much cleaner! 🎉

---

## ✅ Recommended Approach

**Step 1:** Archive important docs
```bash
# Keep the valuable reference material
mv AI-CHEF-SYSTEM.md docs/
mv DATABASE-SCHEMA-INFO.md docs/
mv SCHEMA-REFERENCE.md docs/
```

**Step 2:** Delete temporary progress files
```bash
# Remove temporary status markers
rm 406-ERROR-RESOLVED.md \
   ACCOUNT-INFO-IMPLEMENTED.md \
   CREDENTIALS-UPDATED.md \
   DATABASE-CONSTRAINT-FIX.md \
   DATABASE-MAPPING-FIX-COMPLETE.md \
   FINAL-PR-STATUS.md \
   PR-READY.md \
   PRE-PR-CHECKLIST-READY.md \
   PROFILE-TABLE-FIX-APPLIED.md \
   RECIPE-CONTENT-SCHEMA-FIX.md \
   SCHEMA-FIELD-NAMES-FIXED.md \
   SCHEMA-MIGRATION-COMPLETE.md \
   SCHEMA-PERMISSIONS-FIXED.md \
   SETUP-COMPLETE.md \
   SHOPPING-LIST-FIX.md \
   SSO-CLEANUP-COMPLETE.md \
   SSO-READY.md
```

**Step 3:** Handle remaining files
```bash
# Move migration docs if needed
mv CHEF_APP_DATABASE_MIGRATION_GUIDE.md docs/
mv MIGRATION-COMPLETE.md docs/

# Review and delete screenshot if not needed
rm -rf assets/
```

**Step 4:** Verify
```bash
git status
ls *.md  # Should only show README.md
```

---

## 🎯 Benefits

After cleanup:
- ✅ Cleaner repository structure
- ✅ Important docs organized in `/docs` folder
- ✅ No temporary progress files cluttering root
- ✅ Easier to find documentation
- ✅ Better for new contributors
- ✅ Professional repository appearance

---

*Created: December 5, 2025*  
*Purpose: Pre-PR repository organization*
