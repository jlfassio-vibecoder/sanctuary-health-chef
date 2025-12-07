import React, { useState } from 'react';
import { supabase } from '../services/dbService';
import { ChefHat, Loader2, Mail, Lock, ArrowRight, AlertTriangle } from 'lucide-react';

export const AuthPage: React.FC = () => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    if (!supabase) {
        setError("Database connection not initialized. Please check your connection.");
        setLoading(false);
        return;
    }

    try {
        if (isSignUp) {
            const { error } = await supabase.auth.signUp({
                email,
                password,
            });
            if (error) throw error;
            alert("Account created! You are now signed in.");
        } else {
            const { error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });
            if (error) throw error;
        }
    } catch (err: any) {
        setError(err.message || "Authentication failed");
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md animate-in fade-in zoom-in duration-500">
        
        {/* Logo Header */}
        <div className="text-center mb-8">
            <div className="bg-lime-500 w-16 h-16 rounded-2xl mx-auto flex items-center justify-center shadow-lg shadow-lime-900/50 mb-4 transform rotate-3 hover:rotate-6 transition-transform">
                <ChefHat className="text-slate-900 w-10 h-10" />
            </div>
            <h1 className="text-3xl font-bold text-white tracking-tight">Fit<span className="text-lime-400">copilot</span> Chef</h1>
            <p className="text-slate-400 mt-2">Your AI-powered personal culinary nutritionist.</p>
        </div>

        {/* Auth Card */}
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8 shadow-2xl">
            <h2 className="text-xl font-bold text-white mb-6 flex items-center gap-2">
                {isSignUp ? "Create an Account" : "Welcome Back"}
            </h2>

            {error && (
                <div className="bg-red-500/10 border border-red-500/50 p-3 rounded-lg flex items-start gap-3 mb-6">
                    <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
                    <p className="text-red-400 text-sm">{error}</p>
                </div>
            )}

            <form onSubmit={handleAuth} className="space-y-4">
                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Email Address</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                        <input 
                            type="email" 
                            required
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            placeholder="chef@example.com"
                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:border-lime-500 outline-none transition-colors"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Password</label>
                    <div className="relative">
                        <Lock className="absolute left-3 top-3.5 w-5 h-5 text-slate-500" />
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="••••••••"
                            minLength={6}
                            className="w-full bg-slate-950 border border-slate-700 text-white rounded-xl pl-10 pr-4 py-3 focus:border-lime-500 outline-none transition-colors"
                        />
                    </div>
                </div>

                <button 
                    type="submit"
                    disabled={loading}
                    className="w-full bg-lime-500 hover:bg-lime-400 text-slate-900 font-bold py-4 rounded-xl shadow-lg shadow-lime-900/20 transform transition-all active:scale-[0.98] flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                >
                    {loading ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <>
                            {isSignUp ? "Create Account" : "Sign In"} <ArrowRight className="w-5 h-5" />
                        </>
                    )}
                </button>
            </form>

            <div className="mt-6 pt-6 border-t border-slate-800 text-center">
                <p className="text-slate-400 text-sm">
                    {isSignUp ? "Already have an account?" : "New to FitCopilot?"}
                    <button 
                        onClick={() => setIsSignUp(!isSignUp)}
                        className="text-lime-400 font-bold hover:underline ml-2"
                    >
                        {isSignUp ? "Sign In" : "Sign Up"}
                    </button>
                </p>
            </div>
        </div>
      </div>
    </div>
  );
};