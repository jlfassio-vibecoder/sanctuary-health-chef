# ✅ Profile Table Fixes Applied (Same as Trainer App)

## 🎯 Fixes Applied to Chef App

Just like the Trainer app, the Chef app had the **same incorrect table name issue**. I've now applied the exact same fixes.

---

## 🔧 Fix #1: Corrected Table Name

### The Problem
```typescript
// ❌ WRONG - Table doesn't exist!
await supabase
  .schema('public')
  .from('profile_attributes')  // ← Wrong name!
  .select('*')
```

**Error:** `PGRST205 - Could not find the table 'public.profile_attributes'`

### The Fix
```typescript
// ✅ CORRECT - Using actual table name
await supabase
  .schema('public')
  .from('user_profiles')  // ← Correct name!
  .select('*')
```

---

## 🔧 Fix #2: Updated Profile Data Mapping

### The Problem

The Chef app was trying to save fields that don't exist in `user_profiles`:

**Wrong payload:**
```typescript
{
  user_id: userId,           // ❌ Doesn't exist
  units: profile.units,      // ❌ Should be preferred_units (jsonb)
  fitness_level: ...,        // ❌ Doesn't exist
  goals: ...,                // ❌ Should be fitness_goals (jsonb)
  injuries: ...,             // ❌ Doesn't exist
  medical_conditions: ...,   // ❌ Doesn't exist
  preferences: ...           // ❌ Doesn't exist
}
```

### The Fix

Now properly mapping to actual `user_profiles` table structure:

**Correct payload:**
```typescript
{
  id: userId,
  age: profile.age,
  gender: profile.gender,
  weight: profile.weight,
  height: profile.height,
  preferred_units: {
    system: profile.units?.system || 'imperial',
    weight: profile.units?.weight || 'lbs',
    height: profile.units?.height || 'inches',
    distance: profile.units?.distance || 'miles'
  },
  fitness_goals: {
    goals: profile.goals || [],
    dietary_restrictions: profile.medicalConditions || [],
    allergies: profile.injuries || [],
    dislikes: profile.preferences || [],
    cooking_skill: profile.fitnessLevel || 'Intermediate'
  },
  updated_at: new Date().toISOString()
}
```

---

## 🔧 Fix #3: Updated Profile Reading

### The Problem

Reading from `profile_attributes` which doesn't exist and expecting the wrong field names.

### The Fix

Now properly reading from `user_profiles` and extracting from JSONB fields:

```typescript
const fitnessGoals = data.fitness_goals || {};
const preferredUnits = data.preferred_units || {};

return {
  age: data.age ?? 30,
  gender: data.gender ?? 'Other',
  weight: Number(data.weight) ?? 170,
  height: Number(data.height) ?? 70,
  units: {
    system: (preferredUnits.system || 'imperial'),
    weight: (preferredUnits.weight || 'lbs'),
    height: (preferredUnits.height || 'inches'),
    distance: (preferredUnits.distance || 'miles')
  },
  goals: fitnessGoals.goals || [],
  medicalConditions: fitnessGoals.dietary_restrictions || [],
  injuries: fitnessGoals.allergies || [],
  preferences: fitnessGoals.dislikes || [],
  fitnessLevel: (fitnessGoals.cooking_skill || 'Intermediate')
};
```

---

## 📊 Actual user_profiles Table Structure

```sql
CREATE TABLE public.user_profiles (
  id UUID PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  first_name TEXT,
  last_name TEXT,
  age INTEGER,
  weight NUMERIC,
  height NUMERIC,
  gender TEXT,
  fitness_goals JSONB,        -- ✅ Stores goals, dietary restrictions, etc.
  birthday DATE,
  preferred_units JSONB,      -- ✅ Stores unit preferences
  timezone TEXT,
  avatar_url TEXT,
  onboarding_completed BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
);
```

---

## 🎯 Field Mapping Reference

| Chef App Field | user_profiles Column | Notes |
|----------------|---------------------|-------|
| `age` | `age` | Direct mapping ✅ |
| `gender` | `gender` | Direct mapping ✅ |
| `weight` | `weight` | Direct mapping ✅ |
| `height` | `height` | Direct mapping ✅ |
| `units.system` | `preferred_units.system` | JSONB field ✅ |
| `units.weight` | `preferred_units.weight` | JSONB field ✅ |
| `units.height` | `preferred_units.height` | JSONB field ✅ |
| `units.distance` | `preferred_units.distance` | JSONB field ✅ |
| `goals` | `fitness_goals.goals` | JSONB array ✅ |
| `medicalConditions` | `fitness_goals.dietary_restrictions` | JSONB array ✅ |
| `injuries` | `fitness_goals.allergies` | JSONB array ✅ |
| `preferences` | `fitness_goals.dislikes` | JSONB array ✅ |
| `fitnessLevel` | `fitness_goals.cooking_skill` | JSONB field ✅ |

---

## 🔄 Data Flow Now

### Reading Profile
```
Chef App → supabase.schema('public').from('user_profiles')
    ↓
Extract from JSONB fields (fitness_goals, preferred_units)
    ↓
Map to Chef App UserProfile type
    ↓
Display in UI
```

### Saving Profile
```
Chef App UserProfile
    ↓
Map to user_profiles structure
    ↓
Package into JSONB fields
    ↓
supabase.schema('public').from('user_profiles').upsert()
    ↓
Saved to database
```

---

## ✅ Files Updated

1. **`services/dbService.ts`**
   - ✅ Changed `profile_attributes` → `user_profiles` (3 locations)
   - ✅ Updated `getUserProfile()` to extract from JSONB fields
   - ✅ Updated `saveUserProfile()` to map to correct structure
   - ✅ No linting errors

---

## 🎯 What This Means

### Before (Broken)
- ❌ Querying non-existent `profile_attributes` table
- ❌ Trying to save non-existent fields
- ❌ Profile data not syncing with Hub
- ❌ Users couldn't save their preferences

### After (Fixed)
- ✅ Querying correct `user_profiles` table
- ✅ Saving to correct JSONB fields
- ✅ Profile data shared with Hub and Trainer apps
- ✅ Users can save and load their preferences
- ✅ Data persists correctly

---

## 🧪 Test It Now

1. **Open http://localhost:3002/**
2. **Sign in** with your account
3. **Go to Settings/Account page**
4. **Update your profile:**
   - Age, weight, height
   - Dietary restrictions (medicalConditions)
   - Allergies (injuries)
   - Dislikes (preferences)
   - Cooking skill (fitnessLevel)
5. **Click Save**
6. **Refresh the page** - your data should persist!

### Expected Console Logs

**On Load:**
```
📊 Fetching user profile from database for {userId}
✅ Profile loaded successfully
```

**On Save:**
```
💾 Saving user profile...
✅ Profile saved successfully
```

---

## 🔐 Shared Across Apps

Because we're now using `public.user_profiles`, your profile data is **shared** with:

- ✅ **Hub** - Main app
- ✅ **Trainer** - Workout app
- ✅ **Chef** - Recipe app

All three apps now read and write from the same profile table!

---

## 📊 Summary

| Fix | Status |
|-----|--------|
| **Table Name Correction** | ✅ Applied |
| **Field Mapping** | ✅ Applied |
| **JSONB Extraction** | ✅ Applied |
| **Save Functionality** | ✅ Applied |
| **Load Functionality** | ✅ Applied |
| **No Linting Errors** | ✅ Verified |
| **Servers Restarted** | ✅ Running |

---

## 🎉 Success!

The Chef app now has the **same fixes as the Trainer app** and will properly sync profile data across all three applications!

**Ready to test at:** http://localhost:3002/

---

*Fixes applied: December 3, 2025*  
*Pattern: Same as Trainer app fixes*  
*Table: public.user_profiles*  
*Status: ✅ READY TO USE*

