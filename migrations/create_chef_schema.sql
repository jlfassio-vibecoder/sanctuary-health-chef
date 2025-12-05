-- ================================================
-- FitCopilot Chef - Database Schema Migration
-- Creates the 'chef' schema and all required tables
-- 
-- NOTE: This defines the 'chef' schema for the multi-schema architecture.
--       The actual schema already exists in the database.
--       This file serves as documentation and reference.
-- ================================================

-- Create chef schema
CREATE SCHEMA IF NOT EXISTS chef;

-- ================================================
-- 1. CANONICAL INGREDIENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.canonical_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    category TEXT,
    default_unit TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 2. RECIPES TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.recipes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    meal_type TEXT,
    cuisine TEXT,
    servings INTEGER DEFAULT 1,
    prep_time_minutes INTEGER,
    cook_time_minutes INTEGER,
    total_calories INTEGER,
    protein_grams DECIMAL,
    carbs_grams DECIMAL,
    fat_grams DECIMAL,
    is_favorite BOOLEAN DEFAULT FALSE,
    is_public BOOLEAN DEFAULT FALSE,
    chef_persona TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 3. RECIPE CONTENT TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.recipe_content (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES chef.recipes(id) ON DELETE CASCADE,
    section_type TEXT NOT NULL, -- 'ingredients', 'instructions', 'notes', etc.
    content TEXT NOT NULL,
    order_index INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 4. RECIPE INGREDIENTS TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.recipe_ingredients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipe_id UUID NOT NULL REFERENCES chef.recipes(id) ON DELETE CASCADE,
    ingredient_id UUID REFERENCES chef.canonical_ingredients(id) ON DELETE SET NULL,
    quantity DECIMAL,
    unit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- 5. LOCATIONS TABLE (Kitchen storage locations)
-- ================================================
CREATE TABLE IF NOT EXISTS chef.locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, name)
);

-- ================================================
-- 6. USER INVENTORY TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.user_inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES chef.canonical_ingredients(id) ON DELETE CASCADE,
    location_id UUID REFERENCES chef.locations(id) ON DELETE SET NULL,
    in_stock BOOLEAN DEFAULT TRUE,
    quantity DECIMAL,
    unit TEXT,
    expiry_date DATE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, ingredient_id)
);

-- ================================================
-- 7. SHOPPING LIST TABLE
-- ================================================
CREATE TABLE IF NOT EXISTS chef.shopping_list (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    ingredient_id UUID NOT NULL REFERENCES chef.canonical_ingredients(id) ON DELETE CASCADE,
    is_checked BOOLEAN DEFAULT FALSE,
    quantity DECIMAL,
    unit TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ================================================
-- INDEXES
-- ================================================

-- Recipes indexes
CREATE INDEX IF NOT EXISTS idx_recipes_user_id ON chef.recipes(user_id);
CREATE INDEX IF NOT EXISTS idx_recipes_created_at ON chef.recipes(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_recipes_is_public ON chef.recipes(is_public);
CREATE INDEX IF NOT EXISTS idx_recipes_meal_type ON chef.recipes(meal_type);

-- Recipe content indexes
CREATE INDEX IF NOT EXISTS idx_recipe_content_recipe_id ON chef.recipe_content(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_content_section_type ON chef.recipe_content(section_type);

-- Recipe ingredients indexes
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_recipe_id ON chef.recipe_ingredients(recipe_id);
CREATE INDEX IF NOT EXISTS idx_recipe_ingredients_ingredient_id ON chef.recipe_ingredients(ingredient_id);

-- User inventory indexes
CREATE INDEX IF NOT EXISTS idx_user_inventory_user_id ON chef.user_inventory(user_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_ingredient_id ON chef.user_inventory(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_user_inventory_in_stock ON chef.user_inventory(in_stock);

-- Shopping list indexes
CREATE INDEX IF NOT EXISTS idx_shopping_list_user_id ON chef.shopping_list(user_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_ingredient_id ON chef.shopping_list(ingredient_id);
CREATE INDEX IF NOT EXISTS idx_shopping_list_is_checked ON chef.shopping_list(is_checked);

-- Locations indexes
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON chef.locations(user_id);

-- ================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ================================================

-- Enable RLS on all tables
ALTER TABLE chef.canonical_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.recipes ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.recipe_content ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.recipe_ingredients ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.locations ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.user_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE chef.shopping_list ENABLE ROW LEVEL SECURITY;

-- ================================================
-- CANONICAL INGREDIENTS POLICIES
-- ================================================

-- Everyone can read canonical ingredients
CREATE POLICY "Anyone can read canonical ingredients"
    ON chef.canonical_ingredients FOR SELECT
    USING (true);

-- Authenticated users can insert canonical ingredients
CREATE POLICY "Authenticated users can insert ingredients"
    ON chef.canonical_ingredients FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- ================================================
-- RECIPES POLICIES
-- ================================================

-- Users can view their own recipes
CREATE POLICY "Users can view their own recipes"
    ON chef.recipes FOR SELECT
    USING (auth.uid() = user_id OR is_public = true);

-- Users can insert their own recipes
CREATE POLICY "Users can insert their own recipes"
    ON chef.recipes FOR INSERT
    WITH CHECK (auth.uid() = user_id);

-- Users can update their own recipes
CREATE POLICY "Users can update their own recipes"
    ON chef.recipes FOR UPDATE
    USING (auth.uid() = user_id);

-- Users can delete their own recipes
CREATE POLICY "Users can delete their own recipes"
    ON chef.recipes FOR DELETE
    USING (auth.uid() = user_id);

-- ================================================
-- RECIPE CONTENT POLICIES
-- ================================================

-- Users can view content for their own recipes or public recipes
CREATE POLICY "Users can view recipe content"
    ON chef.recipe_content FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_content.recipe_id
            AND (recipes.user_id = auth.uid() OR recipes.is_public = true)
        )
    );

-- Users can insert content for their own recipes
CREATE POLICY "Users can insert recipe content"
    ON chef.recipe_content FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_content.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- Users can update content for their own recipes
CREATE POLICY "Users can update recipe content"
    ON chef.recipe_content FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_content.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- Users can delete content for their own recipes
CREATE POLICY "Users can delete recipe content"
    ON chef.recipe_content FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_content.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- ================================================
-- RECIPE INGREDIENTS POLICIES
-- ================================================

-- Same pattern as recipe content
CREATE POLICY "Users can view recipe ingredients"
    ON chef.recipe_ingredients FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_ingredients.recipe_id
            AND (recipes.user_id = auth.uid() OR recipes.is_public = true)
        )
    );

CREATE POLICY "Users can insert recipe ingredients"
    ON chef.recipe_ingredients FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_ingredients.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can update recipe ingredients"
    ON chef.recipe_ingredients FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_ingredients.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

CREATE POLICY "Users can delete recipe ingredients"
    ON chef.recipe_ingredients FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM chef.recipes
            WHERE recipes.id = recipe_ingredients.recipe_id
            AND recipes.user_id = auth.uid()
        )
    );

-- ================================================
-- LOCATIONS POLICIES
-- ================================================

-- Users can only see their own locations
CREATE POLICY "Users can view their own locations"
    ON chef.locations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own locations"
    ON chef.locations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own locations"
    ON chef.locations FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own locations"
    ON chef.locations FOR DELETE
    USING (auth.uid() = user_id);

-- ================================================
-- USER INVENTORY POLICIES
-- ================================================

-- Users can only see their own inventory
CREATE POLICY "Users can view their own inventory"
    ON chef.user_inventory FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own inventory"
    ON chef.user_inventory FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own inventory"
    ON chef.user_inventory FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own inventory"
    ON chef.user_inventory FOR DELETE
    USING (auth.uid() = user_id);

-- ================================================
-- SHOPPING LIST POLICIES
-- ================================================

-- Users can only see their own shopping list
CREATE POLICY "Users can view their own shopping list"
    ON chef.shopping_list FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own shopping items"
    ON chef.shopping_list FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own shopping items"
    ON chef.shopping_list FOR UPDATE
    USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own shopping items"
    ON chef.shopping_list FOR DELETE
    USING (auth.uid() = user_id);

-- ================================================
-- UPDATED_AT TRIGGERS
-- ================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION chef.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for tables with updated_at
CREATE TRIGGER update_recipes_updated_at
    BEFORE UPDATE ON chef.recipes
    FOR EACH ROW
    EXECUTE FUNCTION chef.update_updated_at_column();

CREATE TRIGGER update_user_inventory_updated_at
    BEFORE UPDATE ON chef.user_inventory
    FOR EACH ROW
    EXECUTE FUNCTION chef.update_updated_at_column();

CREATE TRIGGER update_shopping_list_updated_at
    BEFORE UPDATE ON chef.shopping_list
    FOR EACH ROW
    EXECUTE FUNCTION chef.update_updated_at_column();

-- ================================================
-- SUCCESS MESSAGE
-- ================================================

DO $$
BEGIN
    RAISE NOTICE '✅ Chef schema created successfully!';
    RAISE NOTICE '✅ All 7 tables created with RLS policies';
    RAISE NOTICE '✅ Indexes and triggers configured';
    RAISE NOTICE '🎉 Chef app database is ready!';
END $$;

