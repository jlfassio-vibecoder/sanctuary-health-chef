# Chef App - Database Schema Migration Guide

## Overview

The Chef app now uses the `chef` schema in the shared Supabase database.

ALL database queries must be updated to use `.schema('chef')`.

## Database Schema Structure

```
Shared Supabase Database
├── public schema
│   └── user_profiles (shared across all apps)
└── chef schema (Chef-specific data)
    ├── recipes
    ├── recipe_content
    ├── recipe_ingredients
    ├── canonical_ingredients
    ├── shopping_list
    ├── user_inventory
    └── locations
```

## Required Code Changes

### 1. All Recipe Queries

**Before:**

```typescript
await supabase.from('recipes').select('*')
```

**After:**

```typescript
await supabase.schema('chef').from('recipes').select('*')
```

### 2. All Chef-Specific Tables

Update ALL queries for these tables to use `.schema('chef')`:

- `recipes`
- `recipe_content`
- `recipe_ingredients`
- `canonical_ingredients`
- `shopping_list`
- `user_inventory`
- `locations`

### 3. User Profile Queries

User profiles remain in `public` schema:

```typescript
// ✅ Correct - public schema for profiles
await supabase.schema('public').from('user_profiles').select('*')
```

## Search & Replace Guide

### Step 1: Find All Database Queries

Search for: `.from(`

### Step 2: Update Each Query

| Table | Old | New |
|-------|-----|-----|
| recipes | `.from('recipes')` | `.schema('chef').from('recipes')` |
| recipe_content | `.from('recipe_content')` | `.schema('chef').from('recipe_content')` |
| recipe_ingredients | `.from('recipe_ingredients')` | `.schema('chef').from('recipe_ingredients')` |
| canonical_ingredients | `.from('canonical_ingredients')` | `.schema('chef').from('canonical_ingredients')` |
| shopping_list | `.from('shopping_list')` | `.schema('chef').from('shopping_list')` |
| user_inventory | `.from('user_inventory')` | `.schema('chef').from('user_inventory')` |
| locations | `.from('locations')` | `.schema('chef').from('locations')` |
| user_profiles | `.from('user_profiles')` | `.schema('public').from('user_profiles')` |

## Example: Complete CRUD Operations

```typescript
// GET recipes
const { data: recipes } = await supabase
  .schema('chef')
  .from('recipes')
  .select('*')
  .eq('user_id', userId);

// CREATE recipe
const { data: newRecipe } = await supabase
  .schema('chef')
  .from('recipes')
  .insert({
    user_id: userId,
    name: 'Protein Pancakes',
    meal_type: 'breakfast',
    servings: 2
  })
  .select()
  .single();

// UPDATE recipe
const { data: updated } = await supabase
  .schema('chef')
  .from('recipes')
  .update({ is_favorite: true })
  .eq('id', recipeId)
  .select()
  .single();

// DELETE recipe
const { error } = await supabase
  .schema('chef')
  .from('recipes')
  .delete()
  .eq('id', recipeId);

// GET user profile (public schema)
const { data: profile } = await supabase
  .schema('public')
  .from('user_profiles')
  .select('*')
  .eq('id', userId)
  .single();
```

## Testing Checklist

After updating queries, verify:

- [ ] Can view recipes list
- [ ] Can create new recipe
- [ ] Can update recipe
- [ ] Can delete recipe
- [ ] Can add items to shopping list
- [ ] Can view user inventory
- [ ] Can manage storage locations
- [ ] User profile loads correctly
- [ ] No "schema must be public, graphql_public" errors

## RLS Policies (Already Configured)

All tables have proper RLS policies:

- ✅ Users can only see/edit their own data
- ✅ Public recipes can be viewed by anyone
- ✅ All operations require authentication

No database changes needed - only app code updates required.

