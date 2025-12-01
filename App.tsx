
import React, { useState, useEffect } from 'react';
import { ProfileSetup } from './components/ProfileSetup';
import { DailyCheckIn } from './components/DailyCheckIn';
import { WorkoutDisplay } from './components/WorkoutDisplay';
import { WorkoutHistory } from './components/WorkoutHistory';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { generateRecipe, updateGeminiApiKey, getGeminiApiKey } from './services/geminiService';
import { verifyDatabaseSchema, getUserProfile, saveUserProfile, supabase } from './services/dbService';
import { UserProfile, DailyContext, TrainerType, Recipe } from './types';
import { ChefHat, BookOpen, Database, AlertTriangle, Loader2, Settings, X, Key, Copy, User } from 'lucide-react';

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

type View = 'generator' | 'history' | 'active-workout' | 'account';
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

  // 1. Auth
  useEffect(() => {
    if (!supabase) {
        setLoadingSession(false);
        return;
    }
    supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        setLoadingSession(false);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        setSession(session);
        setLoadingSession(false);
        if (session) setCurrentView('generator');
    });
    return () => subscription.unsubscribe();
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
        if (result.message.includes('Missing Table')) setIsSettingsOpen(true);
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

  const copySqlFix = () => {
      const sql = `
-- Enable necessary extensions
create extension if not exists pgcrypto;

-- 1. Profiles Table (Keep existing)
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

-- 2. Workouts Table (Keep for backward compatibility)
create table if not exists public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  created_at timestamptz default now()
);

-- 3. NEW: Recipes Table
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

-- 4. NEW: Recipe Content Table
create table if not exists public.recipe_content (
  id uuid default gen_random_uuid() primary key,
  recipe_id uuid references public.recipes(id) on delete cascade,
  section_type text, 
  title text, 
  items text[], 
  metadata jsonb, 
  order_index int
);

-- 5. Enable RLS
alter table public.profile_attributes enable row level security;
alter table public.workouts enable row level security;
alter table public.recipes enable row level security;
alter table public.recipe_content enable row level security;

-- 6. Idempotent Policy Cleanup
do $$ 
begin
    drop policy if exists "Users can view their own recipes" on public.recipes;
    drop policy if exists "Users can insert their own recipes" on public.recipes;
    drop policy if exists "Users can delete their own recipes" on public.recipes;
    drop policy if exists "Users can view their own recipe content" on public.recipe_content;
    drop policy if exists "Users can insert their own recipe content" on public.recipe_content;
    drop policy if exists "Users can delete their own recipe content" on public.recipe_content;
end $$;

-- 7. Create Policies
create policy "Users can view their own recipes" on public.recipes for select using (auth.uid() = user_id);
create policy "Users can insert their own recipes" on public.recipes for insert with check (auth.uid() = user_id);
create policy "Users can delete their own recipes" on public.recipes for delete using (auth.uid() = user_id);
create policy "Users can view their own recipe content" on public.recipe_content for select using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can insert their own recipe content" on public.recipe_content for insert with check (recipe_id in (select id from public.recipes where user_id = auth.uid()));
create policy "Users can delete their own recipe content" on public.recipe_content for delete using (recipe_id in (select id from public.recipes where user_id = auth.uid()));
      `.trim();
      navigator.clipboard.writeText(sql);
      alert("Updated DB Script copied! Run this in Supabase SQL Editor.");
  };

  if (loadingSession) return <div className="min-h-screen bg-slate-950 flex items-center justify-center"><Loader2 className="w-12 h-12 text-lime-500 animate-spin" /></div>;
  if (!session) return <AuthPage />;

  return (
    <div className="min-h-screen bg-slate-950 pb-20 relative">
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button onClick={() => setIsSettingsOpen(false)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X className="w-5 h-5" /></button>
                <h3 className="text-xl font-bold text-white mb-4">Settings</h3>
                <input type="text" value={tempApiKey} onChange={(e) => setTempApiKey(e.target.value)} placeholder="API Key" className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white mb-4 focus:border-lime-500 outline-none" />
                <button onClick={handleSaveApiKey} className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 rounded-lg mb-8">Save Key</button>
                <div className="border-t border-slate-700 pt-6">
                    <h3 className="text-xl font-bold text-white mb-4 flex gap-2"><Database className="w-6 h-6 text-blue-400" /> Database</h3>
                    {dbStatus === 'error' && <div className="mb-4 bg-red-500/10 border border-red-500/50 p-3 rounded-lg text-red-400 text-sm">{dbMessage}</div>}
                    <button onClick={copySqlFix} className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-3 rounded-lg flex justify-center gap-2"><Copy className="w-4 h-4" /> Copy Setup SQL</button>
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
          <div className="flex items-center gap-2 md:gap-4">
             <button onClick={() => setCurrentView('history')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'history' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Cookbook</span></button>
             <button onClick={() => setCurrentView('account')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'account' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><User className="w-4 h-4" /> <span className="hidden sm:inline">Account</span></button>
             <button onClick={() => setIsSettingsOpen(true)} className="text-slate-400 hover:text-white p-2"><Settings className="w-5 h-5" /></button>
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
        {currentView === 'active-workout' && recipePlan && <WorkoutDisplay plan={recipePlan} units={profile.units} userId={currentUserId!} />}
        {currentView === 'history' && <WorkoutHistory userId={currentUserId!} onLoadWorkout={handleLoadRecipe} />}
      </main>
    </div>
  );
};

export default App;
