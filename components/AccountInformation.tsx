import type { User } from 'firebase/auth';
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
              <Mail className="w-4 h-4 text-[#f0dc7a]" />
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
              <Key className="w-4 h-4 text-[#f0dc7a]" />
              User ID
            </span>
          </label>
          <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
            <span className="text-white font-mono text-xs break-all">
              {user.uid}
            </span>
          </div>
        </div>

        {/* Account Created */}
        {user.metadata.creationTime && (
          <div>
            <label className="block mb-1">
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-[#f0dc7a]" />
                Account Created
              </span>
            </label>
            <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
              <span className="text-white">{formatDate(user.metadata.creationTime)}</span>
            </div>
          </div>
        )}

        {/* Last Sign In */}
        {user.metadata.lastSignInTime && (
          <div>
            <label className="block mb-1">
              <span className="text-sm font-semibold text-slate-300 flex items-center gap-2">
                <Clock className="w-4 h-4 text-[#f0dc7a]" />
                Last Sign In
              </span>
            </label>
            <div className="mt-1 px-4 py-2 bg-slate-900 rounded-lg border border-slate-700">
              <span className="text-white">
                {formatDateTime(user.metadata.lastSignInTime)}
              </span>
            </div>
          </div>
        )}

        {/* App Info */}
        <div className="mt-6 pt-4 border-t border-slate-700">
          <div className="text-xs text-slate-400">
            <span className="font-semibold">App:</span> Sanctuary Health Chef
          </div>
          <div className="text-xs text-slate-400 mt-1">
            <span className="font-semibold">Database:</span> Firestore
          </div>
        </div>
      </div>
    </div>
  );
}

