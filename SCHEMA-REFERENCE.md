# 🗂️ Multi-Schema Reference Guide

## Schema Organization

The Chef app uses **explicit schema specification** for all database queries. This makes the code clear, maintainable, and prevents accidental cross-schema queries.

---

## 📚 Schema Usage Pattern

### ✅ Best Practice: Always Specify Schema

```typescript
// ✅ GOOD - Explicit schema specification
const { data } = await supabase
  .schema('chef')        // Clear which schema we're using
  .from('recipes')
  .select('*');

// ❌ BAD - Implicit default schema
const { data } = await supabase
  .from('recipes')       // Which schema? Unclear!
  .select('*');
```

---

## 🎨 Schema Breakdown

### 1. **`chef` Schema** - Recipe & Kitchen Data

**All Chef-specific data lives here:**

| Table | Purpose | Example Query |
|-------|---------|---------------|
| `recipes` | User's saved recipes | `.schema('chef').from('recipes')` |
| `recipe_content` | Recipe sections/steps | `.schema('chef').from('recipe_content')` |
| `canonical_ingredients` | Master ingredient list | `.schema('chef').from('canonical_ingredients')` |
| `recipe_ingredients` | Recipe ↔ Ingredient links | `.schema('chef').from('recipe_ingredients')` |
| `user_inventory` | User's kitchen inventory | `.schema('chef').from('user_inventory')` |
| `shopping_list` | Shopping list items | `.schema('chef').from('shopping_list')` |
| `locations` | Kitchen storage locations | `.schema('chef').from('locations')` |

### 2. **`public` Schema** - Shared User Data

**Data shared across all apps:**

| Table | Purpose | Example Query |
|-------|---------|---------------|
| `profile_attributes` | User profiles | `.schema('public').from('profile_attributes')` |
| `subscriptions` | User subscriptions | `.schema('public').from('subscriptions')` |
| `auth.users` | Authentication | Built-in auth (no schema needed) |

### 3. **`trainer` Schema** - Workout Data (Read-Only)

**Access via RPC functions only:**

| Function | Purpose | Example Query |
|----------|---------|---------------|
| `get_workout_context_for_recipe` | Recent workout data | `.rpc('get_workout_context_for_recipe', {...})` |

---

## 📖 Code Examples

### Recipe Queries (chef schema)

```typescript
// Get all recipes for user
export async function getRecipes(userId: string) {
  const { data, error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('recipes')
    .select('*')
    .eq('user_id', userId);
    
  return { data, error };
}

// Save new recipe
export async function saveRecipe(recipe: Recipe, userId: string) {
  const { data, error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('recipes')
    .insert({
      user_id: userId,
      title: recipe.title,
      // ... other fields
    })
    .select()
    .single();
    
  return { data, error };
}

// Delete recipe
export async function deleteRecipe(recipeId: string) {
  const { error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('recipes')
    .delete()
    .eq('id', recipeId);
    
  return { error };
}
```

### Shopping List Queries (chef schema)

```typescript
// Get shopping list
export async function getShoppingList(userId: string) {
  const { data, error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('shopping_list')
    .select('id, is_checked, ingredient_id, canonical_ingredients(name)')
    .eq('user_id', userId)
    .order('is_checked', { ascending: true });
    
  return { data, error };
}

// Add item to shopping list
export async function addToShoppingList(userId: string, ingredientId: string) {
  const { error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('shopping_list')
    .insert({
      user_id: userId,
      ingredient_id: ingredientId,
      is_checked: false
    });
    
  return { error };
}
```

### Inventory Queries (chef schema)

```typescript
// Get user's kitchen inventory
export async function getUserInventory(userId: string) {
  const { data, error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('user_inventory')
    .select(`
      id, 
      in_stock, 
      ingredient_id,
      canonical_ingredients ( name, category ),
      locations ( name, id )
    `)
    .eq('user_id', userId);
    
  return { data, error };
}

// Update inventory item
export async function updateInventoryItem(itemId: string, inStock: boolean) {
  const { error } = await supabase
    .schema('chef')  // ✅ Use chef schema
    .from('user_inventory')
    .update({ in_stock: inStock })
    .eq('id', itemId);
    
  return { error };
}
```

### Profile Queries (public schema)

```typescript
// Get user profile
export async function getProfile(userId: string) {
  const { data, error } = await supabase
    .schema('public')  // ✅ Use public schema
    .from('profile_attributes')
    .select('*')
    .eq('id', userId)
    .single();
    
  return { data, error };
}

// Update user profile
export async function updateProfile(userId: string, updates: Partial<Profile>) {
  const { error } = await supabase
    .schema('public')  // ✅ Use public schema
    .from('profile_attributes')
    .update(updates)
    .eq('id', userId);
    
  return { error };
}
```

### Cross-Schema Queries (RPC Functions)

```typescript
// Get workout context from trainer schema
export async function getWorkoutContext(userId: string, hoursBack: number = 24) {
  const { data, error } = await supabase
    .rpc('get_workout_context_for_recipe', {  // ✅ Use RPC for cross-schema
      p_user_id: userId,
      p_hours_back: hoursBack
    });
    
  return { data, error };
}
```

---

## 🎯 Quick Reference Table

| Data Type | Schema | Query Pattern |
|-----------|--------|---------------|
| 🍳 Recipes | `chef` | `.schema('chef').from('recipes')` |
| 📝 Recipe Content | `chef` | `.schema('chef').from('recipe_content')` |
| 🥕 Ingredients | `chef` | `.schema('chef').from('canonical_ingredients')` |
| 🛒 Shopping List | `chef` | `.schema('chef').from('shopping_list')` |
| 🏠 Inventory | `chef` | `.schema('chef').from('user_inventory')` |
| 📦 Locations | `chef` | `.schema('chef').from('locations')` |
| 👤 User Profile | `public` | `.schema('public').from('profile_attributes')` |
| 💳 Subscriptions | `public` | `.schema('public').from('subscriptions')` |
| 💪 Workouts | `trainer` | `.rpc('get_workout_context_for_recipe')` |

---

## 🔒 Row Level Security (RLS)

Each schema has its own RLS policies:

### chef Schema RLS
```sql
-- Users can only see their own recipes
create policy "Users can view their own recipes" 
  on chef.recipes 
  for select 
  using (auth.uid() = user_id);

-- Users can only modify their own inventory
create policy "Users manage inventory" 
  on chef.user_inventory 
  for all 
  using (auth.uid() = user_id);
```

### public Schema RLS
```sql
-- Users can only see their own profile
create policy "Users can view own profile" 
  on public.profile_attributes 
  for select 
  using (auth.uid() = id);
```

---

## 🚨 Common Mistakes to Avoid

### ❌ Mistake 1: Missing Schema Specification

```typescript
// ❌ BAD - Which schema?
const { data } = await supabase
  .from('recipes')
  .select('*');
```

```typescript
// ✅ GOOD - Clear schema
const { data } = await supabase
  .schema('chef')
  .from('recipes')
  .select('*');
```

### ❌ Mistake 2: Wrong Schema

```typescript
// ❌ BAD - Recipes are in chef schema, not public!
const { data } = await supabase
  .schema('public')
  .from('recipes')
  .select('*');
```

```typescript
// ✅ GOOD - Correct schema
const { data } = await supabase
  .schema('chef')
  .from('recipes')
  .select('*');
```

### ❌ Mistake 3: Direct Cross-Schema Queries

```typescript
// ❌ BAD - Can't directly query trainer schema
const { data } = await supabase
  .schema('trainer')
  .from('workouts')
  .select('*');
```

```typescript
// ✅ GOOD - Use RPC function
const { data } = await supabase
  .rpc('get_workout_context_for_recipe', {
    p_user_id: userId,
    p_hours_back: 24
  });
```

---

## 📋 Implementation Checklist

When adding new database queries:

- [ ] Identify which schema the table belongs to
- [ ] Add explicit `.schema('schema_name')` call
- [ ] Add comment explaining schema choice
- [ ] Verify RLS policies allow the operation
- [ ] Test the query works as expected

---

## 🎓 Schema Decision Tree

```
Is this query for...
│
├─ Recipe data?
│  └─ Use .schema('chef')
│
├─ Shopping/Inventory?
│  └─ Use .schema('chef')
│
├─ User profile/subscription?
│  └─ Use .schema('public')
│
└─ Workout data?
   └─ Use .rpc('get_workout_context_for_recipe')
```

---

## 🔍 Debugging Tips

### Check Which Schema a Table Is In

```sql
-- Run in Supabase SQL Editor
SELECT 
  schemaname, 
  tablename 
FROM pg_tables 
WHERE tablename = 'recipes';
```

### Test Schema Access

```javascript
// In browser console
const { data, error } = await supabase
  .schema('chef')
  .from('recipes')
  .select('count');

console.log('Chef schema access:', error ? 'FAILED' : 'SUCCESS', data);
```

### Verify RLS Policies

```sql
-- Run in Supabase SQL Editor
SELECT auth.uid();  -- Your user ID
```

Then check if queries work:
```javascript
const { data, error } = await supabase
  .schema('chef')
  .from('recipes')
  .select('*');

console.log('RLS check:', error ? error.message : `Found ${data.length} recipes`);
```

---

## ✨ Benefits of Explicit Schema Specification

1. **Clarity** - Obvious which schema each query uses
2. **Maintainability** - Easy to understand data flow
3. **Safety** - Prevents accidental cross-schema queries
4. **Documentation** - Code is self-documenting
5. **Debugging** - Clear error messages when schema is wrong

---

## 🎯 Summary

**Golden Rule:** Always use `.schema('schema_name')` before `.from('table')`

```typescript
// Recipe data → chef schema
supabase.schema('chef').from('recipes')

// User data → public schema
supabase.schema('public').from('profile_attributes')

// Workout data → RPC function
supabase.rpc('get_workout_context_for_recipe')
```

This pattern makes your code clear, maintainable, and prevents bugs! ✨

---

*Last Updated: December 3, 2025*  
*Architecture: Multi-Schema (Centralized Database)*

