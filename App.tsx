import React, { useState, useEffect } from 'react';
import { ProfileSetup } from './components/ProfileSetup';
import { DailyCheckIn } from './components/DailyCheckIn';
import { RecipeDisplay } from './components/RecipeDisplay';
import { RecipeHistory } from './components/RecipeHistory';
import { ShoppingList } from './components/ShoppingList';
import { KitchenManager } from './components/KitchenManager';
import { AuthPage } from './components/AuthPage';
import { AccountPage } from './components/AccountPage';
import { generateRecipe } from './services/geminiService';
import { verifyDatabaseSchema, getUserProfile, saveUserProfile, supabase } from './services/dbService';
import { useSchemaBasedSSO, getSSOTokenFromUrl } from './services/SchemaBasedSSO';
import { UserProfile, DailyContext, TrainerType, Recipe } from './types';
import { ChefHat, BookOpen, AlertTriangle, Loader2, User, ShoppingCart, Archive } from 'lucide-react';
import { DEFAULT_PROFILE_VALUES } from './constants/defaults';

// DEBUG LOGGING
console.log('📦 App.tsx module loaded (Multi-Schema Architecture)');

const INITIAL_PROFILE: UserProfile = {
  ...DEFAULT_PROFILE_VALUES,
  fitnessLevel: 'Intermediate',
  goals: ['Healthy Eating'],
  injuries: [],
  medicalConditions: [],
  preferences: ['Oven', 'Stove']
};

type View = 'generator' | 'history' | 'active-workout' | 'account' | 'shopping' | 'kitchen';
type DbStatus = 'checking' | 'connected' | 'error';

const App: React.FC = () => {
  // Standard Supabase Auth State (for non-SSO sessions)
  const [session, setSession] = useState<any>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  
  // Schema-based SSO (URL-based token exchange)
  const { user: ssoUser, session: ssoSession, isLoading: ssoLoading, error: ssoError } = useSchemaBasedSSO(supabase);
  
  // Combined session/user state (SSO takes precedence)
  const activeSession = ssoSession || session;
  const activeUser = ssoUser || activeSession?.user;
  const currentUserId = activeUser?.id;
  const currentUserEmail = activeUser?.email;
  const isAuthenticated = !!activeSession;

  const [profile, setProfile] = useState<UserProfile>(INITIAL_PROFILE);
  const [isProfileLoading, setIsProfileLoading] = useState(false);
  
  const [recipePlan, setRecipePlan] = useState<Recipe | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentView, setCurrentView] = useState<View>('generator');
  
  const [dbStatus, setDbStatus] = useState<DbStatus>('checking');
  const [dbMessage, setDbMessage] = useState<string>('Connecting...');

  // Standard Supabase Auth
  useEffect(() => {
    if (!supabase) {
      console.log('⚠️ App.tsx: No Supabase client available');
      setLoadingSession(false);
      return;
    }
    
    console.log('🔐 App.tsx: Initializing Supabase auth (multi-schema)');
    
    const checkSupabase = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      console.log('🔐 Session:', session ? `User: ${session.user.email}` : 'No session');
      setSession(session);
      setLoadingSession(false);
    };

    checkSupabase();
    
    // Set up Supabase auth state listener
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event: string, session: any) => {
      console.log('🔐 Auth state changed:', session ? `User: ${session.user.email}` : 'Signed out');
      setSession(session);
      setLoadingSession(false);
    });
    
    return () => {
      subscription.unsubscribe();
    };
  }, []);

  // Debug: Check for SSO token on app initialization
  useEffect(() => {
    console.log('🔍 [DEBUG] App.tsx: Initializing, checking for SSO token...');
    const token = getSSOTokenFromUrl();
    if (token) {
      console.log('✅ [DEBUG] App.tsx: SSO token detected in URL on mount');
    } else {
      console.log('ℹ️ [DEBUG] App.tsx: No SSO token in URL on mount');
    }
  }, []);

  // Log authentication state for debugging
  useEffect(() => {
    if (ssoError) {
      console.error('❌ App.tsx: SSO error:', ssoError);
    }
    if (ssoSession && ssoUser) {
      console.log('✅ App.tsx: User authenticated via schema-based SSO:', ssoUser.email);
    }
  }, [ssoUser, ssoSession, ssoError]);

  // Load User Data
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
    }
    setIsProfileLoading(false);
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

  // Show loading if either SSO or standard auth is loading
  if (loadingSession || ssoLoading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-12 h-12 text-lime-500 animate-spin" />
      </div>
    );
  }
  
  // Render AuthPage if not authenticated
  if (!isAuthenticated) return <AuthPage />;

  return (
    <div className="min-h-screen bg-slate-950 pb-24 relative">
      <nav className="bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-800">
        <div className="max-w-4xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2 cursor-pointer group" onClick={handleNewRecipe}>
            <div className="bg-lime-500 p-2 rounded-lg transform group-hover:rotate-12 transition-transform">
              <ChefHat className="text-slate-900 w-5 h-5" />
            </div>
            <span className="text-xl font-bold text-white tracking-tight hidden sm:inline">Fit<span className="text-lime-400">copilot</span> Chef</span>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-2">
            <button onClick={() => setCurrentView('shopping')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'shopping' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><ShoppingCart className="w-4 h-4" /> List</button>
            <button onClick={() => setCurrentView('kitchen')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'kitchen' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><Archive className="w-4 h-4" /> Kitchen</button>
            <button onClick={() => setCurrentView('history')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'history' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><BookOpen className="w-4 h-4" /> Cookbook</button>
            <button onClick={() => setCurrentView('account')} className={`text-sm font-medium transition-colors flex items-center gap-2 px-3 py-2 rounded-lg ${currentView === 'account' ? 'bg-slate-800 text-lime-400' : 'text-slate-400 hover:text-white'}`}><User className="w-4 h-4" /> Account</button>
          </div>

          {/* Mobile Nav Toggle / Simple */}
          <div className="md:hidden flex items-center gap-3">
          </div>
        </div>
      </nav>

      <main className="max-w-4xl mx-auto px-4 py-8">
        {dbStatus !== 'connected' && (
          <div className="mb-4 flex items-center justify-center gap-2 text-xs text-slate-500">
            {dbStatus === 'checking' && <Loader2 className="w-3 h-3 animate-spin" />}
            {dbStatus === 'error' && <div className="flex items-center gap-2 bg-red-900/20 px-3 py-1 rounded-full border border-red-900/50 text-red-400"><AlertTriangle className="w-3 h-3" /> {dbMessage}</div>}
          </div>
        )}

        {currentView === 'account' && <AccountPage userEmail={currentUserEmail} user={activeUser} profile={profile} onSaveProfile={handleProfileSave} />}
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
