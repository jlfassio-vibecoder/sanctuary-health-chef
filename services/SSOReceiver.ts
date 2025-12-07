import { useState, useEffect } from 'react';
import type { SupabaseClient, Session, User } from '@supabase/supabase-js';

// Helper to get environment variables
const getEnvVar = (key: string): string | undefined => {
  try {
    if (
      typeof import.meta !== 'undefined' &&
      'env' in import.meta &&
      typeof import.meta.env === 'object' &&
      import.meta.env &&
      key in import.meta.env &&
      typeof import.meta.env[key] === 'string'
    ) {
      return import.meta.env[key];
    }
  } catch (e) { /* ignore */ }

  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return process.env[key];
    }
  } catch (e) { /* ignore */ }

  return undefined;
};

interface SSOTokenData {
  token: string;  // Custom JWT (metadata only - NOT verified client-side)
  access_token: string;  // Supabase access token
  refresh_token: string;  // Supabase refresh token
  user_id?: string;
  email?: string;
  tier?: string;
  app_access?: Record<string, boolean>;
  expires_at?: string;
}

/**
 * SSOReceiver - Secure SSO Token Receiver for Chef App
 * 
 * SECURITY MODEL:
 * - NO client-side JWT verification
 * - Uses only Supabase's auth.setSession() for server-side validation
 * - Custom JWT treated as metadata only
 * - JWT secret exists ONLY in Edge Function, never in client code
 */
class SSOReceiver {
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private isInitialized = false;

  /**
   * Initialize SSO receiver to listen for tokens from Hub
   * 
   * @param onTokenReceived - Callback when SSO token is received
   */
  initialize(onTokenReceived: (tokenData: SSOTokenData) => void | Promise<void>) {
    if (this.isInitialized) {
      console.warn('🔐 SSOReceiver: Already initialized');
      return;
    }

    console.log('🔐 SSOReceiver: Initializing (server-side validation only)...');

    this.messageListener = async (event: MessageEvent) => {
      // Security: Only accept messages from Hub origin
      const hubUrl = getEnvVar('VITE_HUB_URL') || 'http://localhost:5175';
      const allowedOrigins = [
        hubUrl,
        'https://fitcopilot.app',  // Production Hub
        'http://localhost:5175',
        'http://localhost:5174',
        'http://localhost:5173'
      ];

      if (!allowedOrigins.includes(event.origin)) {
        console.warn('🔐 SSOReceiver: Ignoring message from untrusted origin:', event.origin);
        return;
      }

      // Check if this is an SSO token message
      if (event.data && event.data.type === 'SSO_TOKEN') {
        console.log('🔐 SSOReceiver: Received SSO token via postMessage');

        const tokenData = event.data.payload || event.data.token;

        if (!tokenData || !tokenData.access_token || !tokenData.refresh_token) {
          console.error('❌ SSOReceiver: Invalid token data - missing Supabase credentials');
          return;
        }

        console.log('✅ SSOReceiver: Token received with Supabase credentials');

        // Store in sessionStorage for persistence across page reloads
        try {
          sessionStorage.setItem('sso_token_data', JSON.stringify(tokenData));
        } catch (e) {
          console.warn('⚠️ SSOReceiver: Could not store token in sessionStorage:', e);
        }

        // Call the callback with token data
        // The callback should call establishSupabaseSession()
        await onTokenReceived(tokenData);
      }
    };

    window.addEventListener('message', this.messageListener);
    this.isInitialized = true;

    // Send ready message to Hub if in iframe
    if (window.parent !== window) {
      const hubOrigin = getEnvVar('VITE_HUB_URL') || 'http://localhost:5175';
      window.parent.postMessage({ type: 'SSO_READY' }, hubOrigin);
      console.log('✅ SSOReceiver: Sent SSO_READY message to Hub');
    }

    console.log('✅ SSOReceiver: Listening for SSO tokens from Hub');
  }

  /**
   * ⭐ CRITICAL: Establish Supabase session with server-side validation
   * 
   * This is the ONLY authentication method - no client-side JWT verification!
   * Supabase validates the tokens server-side via its auth API.
   * 
   * @param supabaseClient - Initialized Supabase client
   * @param tokenData - SSO token data with access_token and refresh_token
   * @returns Authenticated session
   */
  async establishSupabaseSession(
    supabaseClient: SupabaseClient,
    tokenData: SSOTokenData
  ): Promise<Session | null> {
    try {
      console.log('🔑 SSOReceiver: Establishing Supabase session (server-side validation)...');

      // ✅ SECURITY: Supabase validates tokens server-side
      // No client-side JWT verification needed or wanted!
      const { data, error } = await supabaseClient.auth.setSession({
        access_token: tokenData.access_token,
        refresh_token: tokenData.refresh_token,
      });

      if (error) {
        console.error('❌ SSOReceiver: Failed to establish session:', error);
        throw error;
      }

      if (!data.session) {
        console.error('❌ SSOReceiver: No session returned from setSession');
        return null;
      }

      console.log('✅ SSOReceiver: Supabase session established:', data.session.user.email);
      return data.session;
    } catch (error) {
      console.error('❌ SSOReceiver: Session establishment failed:', error);
      throw error;
    }
  }

  /**
   * Cleanup - remove event listeners
   */
  cleanup() {
    if (this.messageListener) {
      window.removeEventListener('message', this.messageListener);
      this.messageListener = null;
      this.isInitialized = false;
      console.log('🔐 SSOReceiver: Cleanup complete');
    }
  }

  /**
   * Check if SSO token exists in sessionStorage
   */
  hasSSOToken(): boolean {
    try {
      return !!sessionStorage.getItem('sso_token_data');
    } catch (e) {
      return false;
    }
  }

  /**
   * Get stored SSO token data
   */
  getStoredTokenData(): SSOTokenData | null {
    try {
      const data = sessionStorage.getItem('sso_token_data');
      return data ? JSON.parse(data) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear SSO data from sessionStorage
   */
  clearSSOData() {
    try {
      sessionStorage.removeItem('sso_token_data');
      console.log('🔐 SSOReceiver: SSO data cleared');
    } catch (e) {
      console.warn('⚠️ SSOReceiver: Could not clear SSO data:', e);
    }
  }
}

// Export singleton instance
export const ssoReceiver = new SSOReceiver();

/**
 * React Hook: useSSOAuth
 * 
 * Handles SSO authentication with automatic session establishment.
 * Use this in your App component for seamless SSO integration.
 * 
 * @param supabaseClient - Initialized Supabase client
 * @returns Authentication state
 * 
 * @example
 * ```typescript
 * const { user, session, isLoading, error } = useSSOAuth(supabase);
 * 
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error.message}</div>;
 * if (!session) return <AuthPage />;
 * 
 * return <div>Welcome, {user.email}!</div>;
 * ```
 */
export function useSSOAuth(supabaseClient: SupabaseClient) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    // Check for existing session
    supabaseClient.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    // Listen for SSO tokens from Hub
    ssoReceiver.initialize(async (tokenData) => {
      try {
        console.log('🔐 useSSOAuth: Received SSO token');
        
        // Establish Supabase session (server-side validation)
        const session = await ssoReceiver.establishSupabaseSession(
          supabaseClient,
          tokenData
        );

        if (session) {
          setSession(session);
          setUser(session.user);
          setError(null);
        }
      } catch (err) {
        console.error('❌ useSSOAuth: Failed to establish session:', err);
        setError(err as Error);
        ssoReceiver.clearSSOData();
      }
    });

    // Listen for auth state changes
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(
      (_event, session) => {
        setSession(session);
        setUser(session?.user ?? null);
        setIsLoading(false);
      }
    );

    return () => {
      subscription.unsubscribe();
      ssoReceiver.cleanup();
    };
  }, [supabaseClient]);

  return { user, session, isLoading, error };
}
