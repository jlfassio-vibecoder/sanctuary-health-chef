import React from 'react';
import { UserProfile } from '../types';
import { ProfileSetup } from './ProfileSetup';
import { LogOut, User, Mail, ShieldCheck } from 'lucide-react';
import { supabase } from '../services/dbService';

interface Props {
    userEmail?: string;
    profile: UserProfile;
    onSaveProfile: (p: UserProfile) => void;
}

export const AccountPage: React.FC<Props> = ({ userEmail, profile, onSaveProfile }) => {
    const handleSignOut = async () => {
        await supabase.auth.signOut();
    };

    return (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500 max-w-4xl mx-auto">
            <h2 className="text-3xl font-bold text-white mb-6">Account & Settings</h2>
            
            {/* Account Info Card */}
            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden mb-8">
                <div className="p-6 border-b border-slate-700 flex flex-col md:flex-row justify-between items-center gap-6">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-slate-700 rounded-full flex items-center justify-center border-4 border-slate-800 shadow-xl">
                            <User className="w-8 h-8 text-slate-300" />
                        </div>
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <h3 className="text-xl font-bold text-white">My Account</h3>
                                <span className="bg-lime-500/10 text-lime-400 text-[10px] uppercase font-bold px-2 py-0.5 rounded border border-lime-500/20">Active</span>
                            </div>
                            <div className="flex items-center gap-2 text-slate-400 text-sm">
                                <Mail className="w-3 h-3" /> {userEmail || 'No email found'}
                            </div>
                        </div>
                    </div>

                    <button 
                        onClick={handleSignOut}
                        className="px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 hover:border-red-500/50 rounded-xl flex items-center gap-2 transition-all font-medium text-sm"
                    >
                        <LogOut className="w-4 h-4" /> Sign Out
                    </button>
                </div>
                
                <div className="bg-slate-900/50 p-4 flex items-center gap-3 text-xs text-slate-500">
                    <ShieldCheck className="w-4 h-4 text-slate-600" />
                    <span>Your data is securely stored and protected.</span>
                </div>
            </div>

            {/* Reuse Profile Setup Component */}
            <div className="mb-8">
                 <h3 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                    Dietary Preferences
                 </h3>
                 <p className="text-slate-400 mb-4 text-sm">
                    Manage your biometrics, allergies, and cooking equipment. This data is used to tailor every recipe.
                 </p>
                 <ProfileSetup profile={profile} onSave={onSaveProfile} />
            </div>
        </div>
    );
};