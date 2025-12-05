import type { User } from '@supabase/supabase-js';
import { Mail, Key, CalendarDays, Clock } from 'lucide-react';

interface AccountInformationProps {
  user: User | null;
}

export default function AccountInformation({ user }: AccountInformationProps) {
  if (!user) {
    return (
      <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
        <h2 className="text-xl font-bold mb-4 text-white">Account</h2>
        <div className="text-slate-400">No account information available</div>
      </div>
    );
  }

  // Format dates
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('en-US', {
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      second: 'numeric',
      hour12: true,
    });
  };

  return (
    <div className="bg-slate-800 rounded-2xl border border-slate-700 p-6">
      <h2 className="text-xl font-bold mb-4 text-white">Account</h2>
      
      <div className="space-y-4">
        {/* Email */}
        <div>
          <label className="block mb-1">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Mail className="w-4 h-4 text-lime-500" />
              Email
            </span>
          </label>
          <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
            <span className="text-white font-mono text-sm">{user.email}</span>
          </div>
        </div>

        {/* User ID */}
        <div>
          <label className="block mb-1">
            <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <Key className="w-4 h-4 text-lime-500" />
              User ID
            </span>
          </label>
          <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
            <span className="text-white font-mono text-xs break-all">
              {user.id}
            </span>
          </div>
        </div>

        {/* Account Created */}
        {user.created_at && (
          <div>
            <label className="block mb-1">
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-lime-500" />
                Account Created
              </span>
            </label>
            <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
              <span className="text-white">{formatDate(user.created_at)}</span>
            </div>
          </div>
        )}

        {/* Last Sign In */}
        {user.last_sign_in_at && (
          <div>
            <label className="block mb-1">
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-lime-500" />
                Last Sign In
              </span>
            </label>
            <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
              <span className="text-white">
                {formatDateTime(user.last_sign_in_at)}
              </span>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <span className="font-semibold">App:</span> FitCopilot Chef
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span className="font-semibold">Database:</span> Shared (chef schema)
          </div>
        </div>
      </div>
    </div>
  );
}

