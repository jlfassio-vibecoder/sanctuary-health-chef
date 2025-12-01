
import React, { useState, useEffect } from 'react';
import { ProfileSetup } from './components/ProfileSetup';
import { DailyCheckIn } from './components/DailyCheckIn';
import { WorkoutDisplay } from './components/WorkoutDisplay';
import { WorkoutHistory } from './components/WorkoutHistory';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { generateWorkout, updateGeminiApiKey, getGeminiApiKey } from './services/geminiService';
import { verifyDatabaseSchema, getUserProfile, saveUserProfile, supabase } from './services/dbService';
import { UserProfile, DailyContext, TrainerType, WorkoutPlan } from './types';
import { ChefHat, BookOpen, Database, AlertTriangle, Loader2, Settings, X, Key, Copy, User, RefreshCw } from 'lucide-react';

const INITIAL_PROFILE: UserProfile = {
  age: 30,
  gender: 'Male',
  weight: 175,
  height: 70,
  units: 'standard',
  fitnessLevel: 'Intermediate', // Cooking Skill
  goals: ['Healthy Eating'],
  injuries: [], // Allergies
  medicalConditions: [], // Dietary Restrictions
  preferences: ['Oven', 'Stove'] // Equipment
};

type View = 'generator' | 'history' | 'active-workout' | 'account';
type DbStatus = 'checking' | 'connected' | 'error';

const App: React.FC = () => {
  // Session State
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const currentUserId = session?.user?.id;
  const currentUserEmail = session?.user?.email;

  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  const [workoutPlan, setWorkoutPlan] = useState<WorkoutPlan | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('generator');
  
  // Database Status State
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbMessage, setDbMessage] = useState<string>('Connecting...');

  // Settings / API Key State
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [tempApiKey, setTempApiKey] = useState('');

  // 1. Auth & Session Management
  useEffect(() => {
    if (!supabase) {
        setLoadingSession(false);
        return;
    }

    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: any) => {
        setSession(session);
        setLoadingSession(false);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
        setSession(session);
        setLoadingSession(false);
        // Reset view to generator on login
        if (session) {
            setCurrentView('generator');
        }
    });

    return () => subscription.unsubscribe();
  }, []);

  // 2. Load User Data
  useEffect(() => {
    if (currentUserId) {
        loadDataForUser(currentUserId);
    }
  }, [currentUserId]);

  // Helper to load data for a specific user ID
  const loadDataForUser = async (uid: string) => {
    setIsProfileLoading(true);
    
    // 1. Verify DB
    const result = await verifyDatabaseSchema();
    if (result.success) {
        setDbStatus('connected');
        setDbMessage(result.message);
        
        // 2. Fetch Profile from DB
        const fetchedProfile = await getUserProfile(uid);
        if (fetchedProfile) {
            setProfile(fetchedProfile);
        } else {
            // First time user? Save default profile
            await saveUserProfile(uid, INITIAL_PROFILE);
        }
    } else {
        setDbStatus('error');
        setDbMessage(result.message);
        // Only auto-open settings if it's a critical DB error and we are logged in
        if (result.message.includes('Missing Table')) {
             setIsSettingsOpen(true);
        }
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
    if (error?.includes("API key")) {
        setError(null);
    }
  };

  const handleProfileSave = async (updatedProfile: UserProfile) => {
      if (!currentUserId) return;
      setProfile(updatedProfile);
      const success = await saveUserProfile(currentUserId, updatedProfile);
      if (success) {
          console.log("Profile saved to DB successfully");
      }
  };

  const handleGenerate = async (dailyContext: DailyContext, trainer: TrainerType) => {
    setIsLoading(true);
    setError(null);
    setWorkoutPlan(null);
    
    window.scrollTo({ top: 0, behavior: 'smooth' });

    try {
      const plan = await generateWorkout(profile, dailyContext, trainer);
      if (!plan) {
         throw new Error("Received empty recipe plan.");
      }
      setWorkoutPlan(plan);
      setCurrentView('active-workout');
    } catch (err: any) {
      console.error("Generation failed:", err);
      setError(err.message || "Failed to generate recipe. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleLoadWorkout = (plan: WorkoutPlan) => {
      setWorkoutPlan(plan);
      setCurrentView('active-workout');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleNewWorkout = () => {
      setWorkoutPlan(null);
      setCurrentView('generator');
      window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const copySqlFix = () => {
      const sql = `
-- Enable necessary extensions
create extension if not exists pgcrypto;

-- 1. Create Profiles Table (using snake_case for DB columns)
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

-- 2. Create Workouts Table (Recipes)
create table if not exists public.workouts (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text,
  description text,
  difficulty text,
  trainer_notes text,
  total_duration int,
  duration int,
  estimated_calories int,
  trainer_type text,
  focus text,
  exercises text[],
  created_at timestamptz default now()
);

-- 3. Create Workout Exercises Table (Ingredients/Steps)
create table if not exists public.workout_exercises (
  id uuid default gen_random_uuid() primary key,
  workout_id uuid references public.workouts(id) on delete cascade,
  section_type text,
  name text,
  muscle_target text,
  sets_count int,
  tempo text,
  cues text[],
  set_details jsonb
);

-- 4. Enable Row Level Security (RLS)
alter table public.profile_attributes enable row level security;
alter table public.workouts enable row level security;
alter table public.workout_exercises enable row level security;

-- 5. Drop existing policies to allow clean recreation (Idempotency)
do $$ 
begin
    -- Profiles
    drop policy if exists "Users can view their own profile" on public.profile_attributes;
    drop policy if exists "Users can update their own profile" on public.profile_attributes;
    drop policy if exists "Users can insert their own profile" on public.profile_attributes;
    
    -- Workouts
    drop policy if exists "Users can view their own workouts" on public.workouts;
    drop policy if exists "Users can insert their own workouts" on public.workouts;
    drop policy if exists "Users can update their own workouts" on public.workouts;
    drop policy if exists "Users can delete their own workouts" on public.workouts;
    
    -- Exercises
    drop policy if exists "Users can view their own exercises" on public.workout_exercises;
    drop policy if exists "Users can insert their own exercises" on public.workout_exercises;
    drop policy if exists "Users can delete their own exercises" on public.workout_exercises;
end $$;

-- 6. Create RLS Policies

-- Profiles
create policy "Users can view their own profile" on public.profile_attributes 
  for select using (auth.uid() = id);

create policy "Users can update their own profile" on public.profile_attributes 
  for update using (auth.uid() = id);

create policy "Users can insert their own profile" on public.profile_attributes 
  for insert with check (auth.uid() = id);

-- Workouts
create policy "Users can view their own workouts" on public.workouts 
  for select using (auth.uid() = user_id);

create policy "Users can insert their own workouts" on public.workouts 
  for insert with check (auth.uid() = user_id);

create policy "Users can update their own workouts" on public.workouts 
  for update using (auth.uid() = user_id);

create policy "Users can delete their own workouts" on public.workouts 
  for delete using (auth.uid() = user_id);

-- Exercises
create policy "Users can view their own exercises" on public.workout_exercises 
  for select using (
    workout_id in (select id from public.workouts where user_id = auth.uid())
  );

create policy "Users can insert their own exercises" on public.workout_exercises 
  for insert with check (
    workout_id in (select id from public.workouts where user_id = auth.uid())
  );

create policy "Users can delete their own exercises" on public.workout_exercises 
  for delete using (
    workout_id in (select id from public.workouts where user_id = auth.uid())
  );
      `.trim();
      navigator.clipboard.writeText(sql);
      alert("Database Setup SQL copied to clipboard!\n\nPaste this into the Supabase SQL Editor to fix the missing tables.");
  };

  // LOADING STATE
  if (loadingSession) {
    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4 text-center">
            <div className="bg-slate-900 p-8 rounded-2xl border border-slate-800 shadow-xl max-w-md w-full animate-in fade-in duration-700">
                <Loader2 className="w-12 h-12 text-lime-500 animate-spin mx-auto mb-6" />
                <h2 className="text-2xl font-bold text-white mb-2">Starting Kitchen...</h2>
            </div>
        </div>
    );
  }

  // NOT AUTHENTICATED -> SHOW LOGIN
  if (!session) {
      return <AuthPage />;
  }

  // AUTHENTICATED APP
  return (
    <div className="min-h-screen bg-slate-950 pb-20 relative">
      
      {/* Settings Modal */}
      {isSettingsOpen && (
        <div className="fixed inset-0 z-[100] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 w-full max-w-md shadow-2xl relative max-h-[90vh] overflow-y-auto">
                <button 
                   onClick={() => setIsSettingsOpen(false)}
                   className="absolute top-4 right-4 text-slate-400 hover:text-white"
                >
                    <X className="w-5 h-5" />
                </button>
                <div className="flex items-center gap-3 mb-4">
                    <div className="bg-lime-500/10 p-2 rounded-lg">
                        <Key className="w-6 h-6 text-lime-400" />
                    </div>
                    <h3 className="text-xl font-bold text-white">API Configuration</h3>
                </div>
                <p className="text-slate-400 text-sm mb-4">
                    Enter your Gemini API Key manually.
                </p>
                <input 
                    type="text" 
                    value={tempApiKey}
                    onChange={(e) => setTempApiKey(e.target.value)}
                    placeholder="AIzaSy..."
                    className="w-full bg-slate-950 border border-slate-700 rounded-lg p-3 text-white mb-4 focus:border-lime-500 outline-none font-mono text-sm"
                />
                <button 
                    onClick={handleSaveApiKey}
                    className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-3 rounded-lg transition-colors mb-8"
                >
                    Save Configuration
                </button>

                <div className="border-t border-slate-700 pt-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="bg-blue-500/10 p-2 rounded-lg">
                            <Database className="w-6 h-6 text-blue-400" />
                        </div>
                        <h3 className="text-xl font-bold text-white">Database Setup</h3>
                    </div>
                    
                    {dbStatus === 'error' && (
                         <div className="mb-4 bg-red-500/10 border border-red-500/50 p-3 rounded-lg">
                            <p className="text-red-400 text-sm flex items-start gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                                {dbMessage}
                            </p>
                         </div>
                    )}

                    <p className="text-slate-400 text-sm mb-4">
                        If you see a "Missing Table" error, copy the SQL script below and run it in your Supabase SQL Editor.
                    </p>
                    <button 
                        onClick={copySqlFix}
                        className="w-full bg-slate-800 hover:bg-slate-700 border border-slate-600 text-slate-300 hover:text-white font-bold py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
                    >
                        <Copy className="w-4 h-4" /> Copy Database Setup SQL
                    </button>
                </div>
            </div>
        </div>
      )}

      {/* Navigation / Header */}
      <nav className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleNewWorkout}>
            <div className="bg-lime-500 p-2 rounded-lg transform group-hover:rotate-12 transition-transform">
              <ChefHat className="text-slate-900 w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight hidden sm:inline">FitCopilot <span className="text-lime-400">Chef</span></span>
          </div>
          
          <div className="flex items-center gap-2 md:gap-4">
             <button 
                onClick={() => setCurrentView('history')}
                className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'history' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
             >
                <BookOpen className="w-4 h-4" /> <span className="hidden sm:inline">Cookbook</span>
             </button>

             <button 
                onClick={() => setCurrentView('account')}
                className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'account' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white hover:bg-slate-800/50'}`}
             >
                <User className="w-4 h-4" /> <span className="hidden sm:inline">Account</span>
             </button>

             <button 
                onClick={() => setIsSettingsOpen(true)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800/50 transition-colors"
             >
                <Settings className="w-5 h-5" />
             </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        
        {dbStatus !== 'connected' && (
             <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
                {dbStatus === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
                {dbStatus === 'error' && (
                    <button 
                         onClick={() => setIsSettingsOpen(true)}
                         className="flex items-center gap-2 bg-red-900/20 px-3 py-1 rounded-full border border-red-900/50 hover:bg-red-900/30 transition-colors"
                    >
                        <AlertTriangle className="w-3 h-3 text-red-500" />
                        <span className="text-red-400">{dbMessage} (Click to Fix)</span>
                    </button>
                )}
             </div>
        )}

        {/* Views */}
        
        {currentView === 'account' && (
            <AccountPage 
                userEmail={currentUserEmail}
                profile={profile}
                onSaveProfile={handleProfileSave}
            />
        )}

        {currentView === 'generator' && (
           <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Show compact profile summary on generator page if not in account view */}
              <ProfileSetup 
                    profile={profile} 
                    onSave={handleProfileSave} 
              />
              <DailyCheckIn 
                onSubmit={handleGenerate} 
                isLoading={isLoading} 
              />
              
              {/* Error Message Display */}
              {error && (
                <div className="mt-6 bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3 animate-in fade-in slide-in-from-bottom-2">
                   <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                   <div>
                       <h4 className="font-bold text-red-400">Recipe Generation Failed</h4>
                       <p className="text-sm opacity-90 mb-2">{error}</p>
                       <button 
                         onClick={() => setError(null)}
                         className="text-xs uppercase font-bold tracking-wider hover:text-white underline"
                       >
                         Dismiss
                       </button>
                   </div>
                </div>
              )}
           </div>
        )}

        {currentView === 'active-workout' && workoutPlan && (
            <WorkoutDisplay 
                plan={workoutPlan} 
                units={profile.units}
                userId={currentUserId!}
            />
        )}

        {currentView === 'history' && (
            <WorkoutHistory 
                userId={currentUserId!}
                onLoadWorkout={handleLoadWorkout}
            />
        )}
      </main>
    </div>
  );
};

export default App;
