import React, { useState, useEffect } from 'react';
import { ProfileSetup } from './components/ProfileSetup';
import { DailyCheckIn } from './components/DailyCheckIn';
import { RecipeDisplay } from './components/RecipeDisplay';
import { RecipeHistory } from './components/RecipeHistory';
import { ShoppingList } from './components/ShoppingList';
import { KitchenManager } from './components/KitchenManager';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { generateRecipe, updateGeminiApiKey, getGeminiApiKey } from './services/geminiService';
import { verifyDatabaseSchema, getUserProfile, saveUserProfile, supabase } from './services/dbService';
import { ssoReceiver } from './services/SSOReceiver';
import { UserProfile, DailyContext, TrainerType, Recipe } from './types';
import { ChefHat, BookOpen, Database, AlertTriangle, Loader2, Settings, X, Key, Copy, User, ShoppingCart, Archive } from 'lucide-react';

const INITIAL_PROFILE: UserProfile = {
  age: 30,
  gender: 'Male',
  weight: 175,
  height: 70,
  units: 'standard',
  fitnessLevel: 'Intermediate',
  goals: ['Healthy Eating'],
  injuries: [],
  medicalConditions: [],
  preferences: ['Oven', 'Stove']
};

type View = 'generator' | 'history' | 'active-workout' | 'account' | 'shopping' | 'kitchen';
type DbStatus = 'checking' | 'connected' | 'error';

const App: React.FC = () => {
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const currentUserId = session?.user?.id;
  const currentUserEmail = session?.user?.email;

  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  const [recipePlan, setRecipePlan] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('generator');
  
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbMessage, setDbMessage] = useState<string>('Connecting...');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // 1. Auth & SSO
  useEffect(() => {
    // Initialize SSO Receiver to listen for token from Hub
    ssoReceiver.initialize();

    if (!supabase) {
        setLoadingSession(false);
        return () => ssoReceiver.cleanup();
    }
    
    // Check for existing session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        setLoadingSession(false);
    });
    
    // Listen for auth changes (including SSO login)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        setSession(session);
        setLoadingSession(false);
        if (session) {
            // If we were on auth page, go to generator
            // If already on a view, stay there (prevents resetting view on refresh)
            // But we can default to generator for new logins
        }
    });
    
    return () => {
        subscription.unsubscribe();
        ssoReceiver.cleanup();
    };
  }, []);

  // 2. Load Data
  useEffect(() => {
    if (currentUserId) loadDataForUser(currentUserId);
  }, [currentUserId]);

  const loadDataForUser = async (uid: string) => {
    setIsProfileLoading(true);
    const result = await verifyDatabaseSchema();
    if (result.success) {
        setDbStatus('connected');
        setDbMessage(result.message);
        const fetchedProfile = await getUserProfile(uid);
        if (fetchedProfile) setProfile(fetchedProfile);
        else await saveUserProfile(uid, INITIAL_PROFILE);
    } else {
        setDbStatus('error');
        setDbMessage(result.message);
        if (result.message.includes('Missing Table') || result.message.includes('Missing Kitchen')) setIsSettingsOpen(true);
    }
    setIsProfileLoading(false);
  };

  // 3. Init API Key
  useEffect(() => {
    setTempApiKey(getGeminiApiKey() || '');
  }, []);

  const handleSaveApiKey = () => {
    updateGeminiApiKey(tempApiKey);
    setIsSettingsOpen(false);
    if (error?.includes("API key")) setError(null);
  };

  const handleProfileSave = async (updatedProfile: UserProfile) => {
      if (!currentUserId) return;
      setProfile(updatedProfile);
      await saveUserProfile(currentUserId, updatedProfile);
  };

  const handleGenerate = async (dailyContext: DailyContext, trainer: TrainerType) => {
    setIsLoading(true);
    setError(null);
    setRecipePlan(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const plan = await generateRecipe(profile, dailyContext, trainer);
      if (!plan) throw new Error("Received empty recipe plan.");
      setRecipePlan(plan);
      setCurrentView('active-workout');
    } catch (err: any) {
      console.error("Generation failed:", err);
      setError(err.message || "Failed to generate recipe.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadRecipe = (plan: Recipe) => {
      setRecipePlan(plan);
      setCurrentView('active-workout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewRecipe = () => {
      setRecipePlan(null);
      setCurrentView('generator');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copyFullSchema = () => {
    const sql = `
-- Enable necessary extensions
create extension if not exists pgcrypto;

-- 1. Profiles Table
create table if not exists public.profile_attributes (
  id uuid references auth.users on delete cascade primary key,
  user_id uuid references auth.users on delete cascade,
  age int,
  gender text,
  weight numeric,
  height numeric,
  units text,
  fitness_level text,
  goals text[],
  injuries text[],
  medical_conditions text[],
  preferences text[],
  updated_at timestamptz default now()
);

-- 2. Workouts Table
create table if not exists public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

-- 3. Recipes Table
create table if not exists public.recipes (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  description text,
  difficulty text,
  chef_note text,
  total_time int,
  calories int,
  cuisine text,
  chef_persona text,
  image_url text,
  created_at timestamptz default now()
);

-- 4. Recipe Content Table
create table if not exists public.recipe_content (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade,
  section_type text, 
  title text, 
  items text[],
  ingredients jsonb,
  metadata jsonb, 
  order_index int
);

-- Add 'ingredients' column if it was missed in a previous version of the schema
do $$
begin
  if not exists (select 1 from information_schema.columns where table_name = 'recipe_content' and column_name = 'ingredients') then
    alter table public.recipe_content add column ingredients jsonb;
  end if;
end $$;

-- 5. Locations
create table if not exists public.locations (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    name text not null,
    icon text
);

-- 6. Canonical Ingredients
create table if not exists public.canonical_ingredients (
    id uuid default gen_random_uuid() primary key,
    name text unique not null,
    category text
);

-- 7. Recipe Ingredients (Link)
create table if not exists public.recipe_ingredients (
    id uuid default gen_random_uuid() primary key,
    recipe_id uuid references public.recipes(id) on delete cascade not null,
    ingredient_id uuid references public.canonical_ingredients(id) not null,
    quantity_value numeric,
    quantity_unit text,
    preparation_note text
);

-- 8. User Inventory
create table if not exists public.user_inventory (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    ingredient_id uuid references public.canonical_ingredients(id) not null,
    location_id uuid references public.locations(id),
    in_stock boolean default true,
    unique(user_id, ingredient_id)
);

-- FIX: Remove duplicate entries in user_inventory before ensuring unique constraint
delete from public.user_inventory
where id in (
  select id
  from (
    select id,
           row_number() over (partition by user_id, ingredient_id order by id) as rnum
    from public.user_inventory
  ) t
  where t.rnum > 1
);

-- Force add constraint if missing (fixes update issues)
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'user_inventory_user_id_ingredient_id_key') then
    alter table public.user_inventory add constraint user_inventory_user_id_ingredient_id_key unique (user_id, ingredient_id);
  end if;
end $$;

-- 9. Shopping List
create table if not exists public.shopping_list (
    id uuid default gen_random_uuid() primary key,
    user_id uuid references auth.users on delete cascade not null,
    ingredient_id uuid references public.canonical_ingredients(id) not null,
    recipe_id uuid references public.recipes(id),
    is_checked boolean default false
);

-- Enable RLS
alter table public.profile_attributes enable row level security;
alter table public.workouts enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_content enable row level security;
alter table public.locations enable row level security;
alter table public.canonical_ingredients enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.user_inventory enable row level security;
alter table public.shopping_list enable row level security;

-- Policies
do $$ 
begin
    -- Cleanup policies to avoid errors on rerun
    drop policy if exists "Users can view their own recipes" on public.recipes;
    drop policy if exists "Users can insert their own recipes" on public.recipes;
    drop policy if exists "Users can delete their own recipes" on public.recipes;
    
    drop policy if exists "Users can view their own recipe content" on public.recipe_content;
    drop policy if exists "Users can insert their own recipe content" on public.recipe_content;
    drop policy if exists "Users can delete their own recipe content" on public.recipe_content;
    
    drop policy if exists "Users view own locations" on public.locations;
    drop policy if exists "Users insert own locations" on public.locations;
    
    drop policy if exists "Everyone can view canonical" on public.canonical_ingredients;
    drop policy if exists "Auth users can insert canonical" on public.canonical_ingredients;
    
    drop policy if exists "Users view own recipe ingredients" on public.recipe_ingredients;
    drop policy if exists "Users insert own recipe ingredients" on public.recipe_ingredients;
    drop policy if exists "Users delete own recipe ingredients" on public.recipe_ingredients;
    
    drop policy if exists "Users manage inventory" on public.user_inventory;
    drop policy if exists "Users manage shopping list" on public.shopping_list;
end $$;

-- Create Policies
-- Recipes
create policy "Users can view their own recipes" on public.recipes for select using (auth.uid() = user_id);
create policy "Users can insert their own recipes" on public.recipes for insert with check (auth.uid() = user_id);
create policy "Users can delete their own recipes" on public.recipes for delete using (auth.uid() = user_id);
-- Content
create policy "Users can view their own recipe content" on public.recipe_content for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert their own recipe content" on public.recipe_content for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete their own recipe content" on public.recipe_content for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
-- Kitchen
create policy "Users view own locations" on public.locations for select using (auth.uid() = user_id);
create policy "Users insert own locations" on public.locations for insert with check (auth.uid() = user_id);
create policy "Everyone can view canonical" on public.canonical_ingredients for select using (true);
create policy "Auth users can insert canonical" on public.canonical_ingredients for insert with check (auth.role() = 'authenticated');
create policy "Users view own recipe ingredients" on public.recipe_ingredients for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users insert own recipe ingredients" on public.recipe_ingredients for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users delete own recipe ingredients" on public.recipe_ingredients for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users manage inventory" on public.user_inventory for all using (auth.uid() = user_id);
create policy "Users manage shopping list" on public.shopping_list for all using (auth.uid() = user_id);
    `.trim();
    navigator.clipboard.writeText(sql);
    alert("Full Database Schema copied! Run this in Supabase SQL Editor to fix missing tables.");
  };

  if (loadingSession) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-lime-500 animate-spin" /></div>;
  if (!session) return <AuthPage />;

  return (
    <div className="min-h-screen bg-slate-950 pb-24 relative">
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                <h3 className="text-xl font-bold text-white mb-4">Settings</h3>
                <input type="text" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="API Key" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white mb-4 focus:border-lime-500 outline-none" />
                <button onClick={handleSaveApiKey} className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 rounded-lg mb-8">Save Key</button>
                <div className="border-t border-slate-700 pt-6 space-y-3">
                    <h3 className="text-xl font-bold text-white mb-4 flex gap-2"><Database className="w-6 h-6 text-blue-400" /> Database</h3>
                    {dbStatus === 'error' && <div className="mb-4 bg-red-500/10 border border-red-500/50 p-3 rounded-lg text-red-400 text-sm">{dbMessage}</div>}
                    <button onClick={copyFullSchema} className="w-full bg-lime-500/10 hover:bg-lime-500/20 text-lime-400 border border-lime-500/50 py-3 rounded-lg flex justify-center gap-2 font-bold"><Copy className="w-4 h-4" /> Copy Full Database Schema</button>
                    <p className="text-xs text-slate-500 text-center">Copy this script and run it in your Supabase SQL Editor to fix missing tables.</p>
                </div>
            </div>
        </div>
      )}

      <nav className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleNewRecipe}>
            <div className="bg-lime-500 p-2 rounded-lg transform group-hover:rotate-12 transition-transform">
              <ChefHat className="text-slate-900 w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight hidden sm:inline">FitCopilot <span className="text-lime-400">Chef</span></span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
             <button onClick={() => setCurrentView('shopping')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'shopping' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><ShoppingCart className="w-4 h-4" /> List</button>
             <button onClick={() => setCurrentView('kitchen')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'kitchen' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><Archive className="w-4 h-4" /> Kitchen</button>
             <button onClick={() => setCurrentView('history')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'history' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><BookOpen className="w-4 h-4" /> Cookbook</button>
             <button onClick={() => setCurrentView('account')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'account' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><User className="w-4 h-4" /> Account</button>
             <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-white p-2"><Settings className="w-5 h-5" /></button>
          </div>

          {/* Mobile Nav Toggle / Simple */}
          <div className="md:hidden flex items-center gap-3">
             <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-white"><Settings className="w-5 h-5" /></button>
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {dbStatus !== 'connected' && (
             <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                {dbStatus === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
                {dbStatus === 'error' && <button onClick={() => setIsSettingsOpen(true)} className="flex items-center gap-2 bg-red-900/20 px-3 py-1 rounded-full border border-red-900/50 text-red-400"><AlertTriangle className="w-3 h-3" /> {dbMessage} (Click to Fix)</button>}
             </div>
        )}

        {currentView === 'account' && <AccountPage userEmail={currentUserEmail} profile={profile} onSaveProfile={handleProfileSave} />}
        {currentView === 'generator' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              <ProfileSetup profile={profile} onSave={handleProfileSave} />
              <DailyCheckIn onSubmit={handleGenerate} isLoading={isLoading} />
              {error && <div className="mt-6 bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex gap-3"><AlertTriangle className="w-5 h-5" /> <div><h4 className="font-bold">Error</h4><p>{error}</p></div></div>}
           </div>
        )}
        {currentView === 'active-workout' && recipePlan && <RecipeDisplay plan={recipePlan} units={profile.units} userId={currentUserId!} />}
        {currentView === 'history' && <RecipeHistory userId={currentUserId!} onLoadWorkout={handleLoadRecipe} />}
        {currentView === 'shopping' && <ShoppingList userId={currentUserId!} />}
        {currentView === 'kitchen' && <KitchenManager userId={currentUserId!} />}
      </main>

      {/* Mobile Bottom Bar */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 p-2 flex justify-around items-center z-50">
          <button onClick={() => setCurrentView('generator')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentView === 'generator' ? 'text-lime-400' : 'text-slate-500'}`}>
              <ChefHat className="w-5 h-5" /> <span className="text-[10px]">Chef</span>
          </button>
          <button onClick={() => setCurrentView('shopping')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentView === 'shopping' ? 'text-lime-400' : 'text-slate-500'}`}>
              <ShoppingCart className="w-5 h-5" /> <span className="text-[10px]">List</span>
          </button>
          <button onClick={() => setCurrentView('kitchen')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentView === 'kitchen' ? 'text-lime-400' : 'text-slate-500'}`}>
              <Archive className="w-5 h-5" /> <span className="text-[10px]">Kitchen</span>
          </button>
          <button onClick={() => setCurrentView('history')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentView === 'history' ? 'text-lime-400' : 'text-slate-500'}`}>
              <BookOpen className="w-5 h-5" /> <span className="text-[10px]">Book</span>
          </button>
          <button onClick={() => setCurrentView('account')} className={`p-2 rounded-lg flex flex-col items-center gap-1 ${currentView === 'account' ? 'text-lime-400' : 'text-slate-500'}`}>
              <User className="w-5 h-5" /> <span className="text-[10px]">Acct</span>
          </button>
      </div>
    </div>
  );
};

export default App;