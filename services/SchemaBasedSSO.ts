/**
 * Schema-Based SSO Service
 * Handles SSO authentication via URL-based token exchange
 * 
 * This replaces the postMessage-based SSO approach with a simpler URL-based flow:
 * 1. Hub generates token and stores in sso_tokens table
 * 2. Hub redirects to Trainer with ?sso_token=xxx in URL
 * 3. Trainer reads token from URL and exchanges it for Supabase session
 * 4. Trainer cleans up URL and establishes authenticated session
 */

import { useEffect, useState, useRef } from 'react';
import type { SupabaseClient, User, Session } from '@supabase/supabase-js';

interface SSOTokenData {
  access_token: string;
  refresh_token: string;
  user_id: string;
  tier: string;
  app_access: Record<string, boolean>;
  expires_at: string;
}

interface UseSchemaBasedSSOReturn {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Debug function to check SSO token extraction from URL
 * 
 * This function helps debug token extraction issues by logging
 * the full URL, search params, and whether a token was found.
 * 
 * @returns The SSO token from URL, or null if not found
 */
export function getSSOTokenFromUrl(): string | null {
  console.log('🔍 [DEBUG] Full URL:', window.location.href);
  console.log('🔍 [DEBUG] Search params:', window.location.search);
  console.log('🔍 [DEBUG] Window location:', {
    href: window.location.href,
    search: window.location.search,
    pathname: window.location.pathname,
    hash: window.location.hash,
  });
  
  const params = new URLSearchParams(window.location.search);
  const token = params.get('sso_token');
  
  console.log('🔍 [DEBUG] Token found:', token ? 'YES' : 'NO');
  if (token) {
    console.log('🔍 [DEBUG] Token value (first 20 chars):', token.substring(0, 20) + '...');
    console.log('🔍 [DEBUG] Token length:', token.length);
  } else {
    console.log('🔍 [DEBUG] All URL params:', Array.from(params.entries()));
  }
  
  return token;
}

/**
 * Exchange SSO token for Supabase session
 * 
 * Queries the sso_tokens table to retrieve Supabase tokens,
 * then establishes a session using those tokens.
 * 
 * @param supabaseClient - The Supabase client instance
 * @param token - The SSO token from URL parameter
 * @returns SSO token data with Supabase tokens, or null if exchange fails
 */
async function exchangeSSOToken(
  supabaseClient: SupabaseClient,
  token: string,
): Promise<SSOTokenData | null> {
  try {
    console.log('🔐 SchemaBasedSSO: Exchanging SSO token...');

    // Try RPC function FIRST (this bypasses RLS and is the correct approach)
    // The RPC function uses SECURITY DEFINER to allow unauthenticated apps to exchange tokens
    try {
      console.log('🔐 SchemaBasedSSO: Attempting RPC function (bypasses RLS)...');
      const { data: rpcData, error: rpcError } = await supabaseClient.rpc('exchange_sso_token', {
        token_value: token,
      });
      
      if (!rpcError && rpcData && rpcData.length > 0) {
        const tokenData = rpcData[0];
        console.log('✅ SchemaBasedSSO: Token exchanged via RPC function');
        return {
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          user_id: tokenData.user_id,
          tier: 'free', // Default tier (can be fetched from subscriptions table if needed)
          app_access: {}, // Default app access
          expires_at: tokenData.expires_at || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        };
      } else if (rpcError) {
        console.error('🔐 SchemaBasedSSO: RPC function error:', rpcError);
        // Fall through to try direct table query (might work if RLS allows it)
      }
    } catch (rpcErr) {
      console.log('🔐 SchemaBasedSSO: RPC function not available, trying direct table query...');
    }

    // Fallback: Try direct table query (will likely fail due to RLS, but worth trying)
    let query = supabaseClient
      .from('sso_tokens')
      .select('access_token, refresh_token, user_id, created_at, id')
      .eq('token', token)
      .single();

    let { data, error } = await query;

    // If that fails, try querying by 'id' (in case token is the UUID primary key)
    if (error && (error.code === 'PGRST116' || error.message?.includes('token') || error.code === 'PGRST301')) {
      console.log('🔐 SchemaBasedSSO: Token field query failed, trying id field...');
      query = supabaseClient
        .from('sso_tokens')
        .select('access_token, refresh_token, user_id, created_at, id')
        .eq('id', token)
        .single();
      
      const result = await query;
      data = result.data;
      error = result.error;
    }

    // If we got a column error, try selecting only the essential columns
    if (error && error.code === '42703') {
      console.log('🔐 SchemaBasedSSO: Column error detected, trying minimal column selection...');
      query = supabaseClient
        .from('sso_tokens')
        .select('access_token, refresh_token, user_id, created_at')
        .eq('token', token)
        .single();
      
      const result = await query;
      data = result.data;
      error = result.error;
    }

    // Handle 406 Not Acceptable (likely RLS blocking) or 0 rows
    if (error) {
      console.error('🔐 SchemaBasedSSO: Error querying sso_tokens:', error);
      console.error('🔐 SchemaBasedSSO: Error code:', error.code);
      console.error('🔐 SchemaBasedSSO: Error message:', error.message);
      
      // If we got 0 rows, the token might not exist or RLS is blocking
      if (error.code === 'PGRST116') {
        console.error('🔐 SchemaBasedSSO: Token not found in database (0 rows). Possible reasons:');
        console.error('  1. Token was already used/deleted');
        console.error('  2. Token expired and was cleaned up');
        console.error('  3. RLS (Row Level Security) is blocking access');
        console.error('  4. Token was generated in a different database/schema');
      }
      
      // RPC function should have been tried first, but if we get here, log the issue
      console.error('🔐 SchemaBasedSSO: Both RPC function and direct table query failed');
      console.error('🔐 SchemaBasedSSO: This should not happen if the RPC function is properly configured');
      
      // If we got a 406, it might be RLS - try without .single() to see if we can query at all
      if (error.code === 'PGRST301' || error.message?.includes('406') || error.code === 'PGRST116') {
        console.log('🔐 SchemaBasedSSO: Got 406/0-rows error, checking if table is accessible at all...');
        const { data: testData, error: testError } = await supabaseClient
          .from('sso_tokens')
          .select('*')
          .limit(1);
        
        if (testError) {
          console.error('❌ SchemaBasedSSO: Cannot access sso_tokens table:', testError);
          console.error('❌ SchemaBasedSSO: This is likely an RLS (Row Level Security) issue');
          console.error('❌ SchemaBasedSSO: The Trainer app needs permission to read from sso_tokens table');
          console.error('❌ SchemaBasedSSO: SOLUTION: Create an RLS policy that allows:');
          console.error('   - SELECT on sso_tokens table for authenticated users');
          console.error('   - Or create an RPC function (exchange_sso_token) that the Trainer can call');
          console.error('   - The RPC function should run with elevated permissions (SECURITY DEFINER)');
        } else {
          console.log('✅ SchemaBasedSSO: Table is accessible, but token not found');
          console.log('ℹ️ SchemaBasedSSO: Token might have expired or been deleted');
          console.log('ℹ️ SchemaBasedSSO: Or the token was generated in a different database/schema');
        }
      }
      
      return null;
    }

    if (!data) {
      console.error('🔐 SchemaBasedSSO: Token not found in sso_tokens table');
      return null;
    }

    // Validate required fields
    if (!data.access_token || !data.refresh_token || !data.user_id) {
      console.error('🔐 SchemaBasedSSO: Missing required fields in token data');
      return null;
    }

    // Check if token is expired (tokens expire after 5 minutes)
    // Use expires_at if available, otherwise calculate from created_at
    let expiresAt: Date;
    if ((data as any).expires_at) {
      expiresAt = new Date((data as any).expires_at);
    } else if (data.created_at) {
      const createdAt = new Date(data.created_at);
      expiresAt = new Date(createdAt.getTime() + 5 * 60 * 1000); // 5 minutes
    } else {
      console.error('🔐 SchemaBasedSSO: No expiration time available');
      return null;
    }

    const now = new Date();
    if (now > expiresAt) {
      console.error('🔐 SchemaBasedSSO: Token has expired');
      // Delete expired token (try both token and id fields)
      try {
        await supabaseClient.from('sso_tokens').delete().eq('token', token);
      } catch {
        await supabaseClient.from('sso_tokens').delete().eq('id', token);
      }
      return null;
    }

    console.log('✅ SchemaBasedSSO: Token found and valid');

    // Return data with defaults for optional fields
    return {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      user_id: data.user_id,
      tier: (data as any).tier || 'free', // Optional field
      app_access: (data as any).app_access || {}, // Optional field
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('🔐 SchemaBasedSSO: Error exchanging token:', error);
    return null;
  }
}

/**
 * Exchange SSO token and establish session
 * 
 * Helper function that exchanges the token and sets the session.
 * 
 * @param token - The SSO token from URL
 * @param supabaseClient - The Supabase client instance
 */
async function exchangeSSOTokenAndSetSession(
  token: string,
  supabaseClient: SupabaseClient,
): Promise<void> {
  console.log('🔐 exchangeSSOTokenAndSetSession: Starting token exchange...');
  
  // Exchange token for Supabase session data
  const tokenData = await exchangeSSOToken(supabaseClient, token);
  console.log('🔍 [DEBUG] exchangeSSOTokenAndSetSession: Token exchange result:', tokenData ? 'SUCCESS' : 'FAILED');

  if (!tokenData) {
    throw new Error('Failed to exchange SSO token');
  }

  console.log('🔍 [DEBUG] exchangeSSOTokenAndSetSession: Token data received, establishing session...');
  console.log('🔍 [DEBUG] exchangeSSOTokenAndSetSession: Has access_token:', !!tokenData.access_token);
  console.log('🔍 [DEBUG] exchangeSSOTokenAndSetSession: Has refresh_token:', !!tokenData.refresh_token);

  // Establish Supabase session
  const { data: sessionData, error: sessionError } =
    await supabaseClient.auth.setSession({
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
    });

  if (sessionError) {
    console.error('❌ exchangeSSOTokenAndSetSession: Session error:', sessionError);
    throw new Error(`Failed to establish session: ${sessionError.message}`);
  }

  if (!sessionData.session) {
    console.error('❌ exchangeSSOTokenAndSetSession: No session returned');
    throw new Error('No session returned from setSession');
  }

  console.log('✅ SchemaBasedSSO: Successfully exchanged SSO token for session');
  console.log('✅ SchemaBasedSSO: User authenticated:', sessionData.session.user.email);

  // Store SSO session metadata in sessionStorage (matches existing pattern)
  const sessionMetadata = {
    user_id: sessionData.session.user.id,
    tier: tokenData.tier,
    app_access: tokenData.app_access,
    expires_at: tokenData.expires_at,
    sso_active: true,
  };
  sessionStorage.setItem('sso_session', JSON.stringify(sessionMetadata));
  sessionStorage.setItem('sso_active', 'true');
  console.log('💾 [DEBUG] exchangeSSOTokenAndSetSession: Session metadata stored');

  // Clean up token from URL
  const newUrl = new URL(window.location.href);
  newUrl.searchParams.delete('sso_token');
  window.history.replaceState({}, '', newUrl.toString());
  console.log('🧹 SchemaBasedSSO: Cleaned sso_token from URL');

  // Delete the token from database after successful exchange
  // (one-time use token) - try both token and id fields
  try {
    await supabaseClient.from('sso_tokens').delete().eq('token', token);
    console.log('🗑️ [DEBUG] exchangeSSOTokenAndSetSession: Token deleted from database');
  } catch (err) {
    // If token field doesn't work, try id field
    console.log('🔍 [DEBUG] exchangeSSOTokenAndSetSession: Token field delete failed, trying id field...');
    try {
      await supabaseClient.from('sso_tokens').delete().eq('id', token);
      console.log('🗑️ [DEBUG] exchangeSSOTokenAndSetSession: Token deleted from database (by id)');
    } catch (err2) {
      console.warn('⚠️ [DEBUG] exchangeSSOTokenAndSetSession: Could not delete token from database:', err2);
    }
  }
}

/**
 * React hook for schema-based SSO authentication
 * 
 * Reads sso_token from URL, exchanges it for Supabase session,
 * and returns authentication state.
 * 
 * @param supabaseClient - The Supabase client instance
 * @returns Object with user, session, isLoading, and error
 * 
 * @example
 * ```typescript
 * const { user, session, isLoading, error } = useSchemaBasedSSO(supabase);
 * ```
 */
export function useSchemaBasedSSO(
  supabaseClient: SupabaseClient,
): UseSchemaBasedSSOReturn {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const tokenProcessedRef = useRef(false); // Use ref to prevent multiple token processing
  const ssoTokenRef = useRef<string | null>(null); // Store token immediately to prevent React Router from stripping it

  // CRITICAL: Read token from URL immediately on mount (synchronously)
  // React Router may navigate and strip query params before async operations complete
  useEffect(() => {
    // Read token synchronously before any async operations
    const params = new URLSearchParams(window.location.search);
    const token = params.get('sso_token');
    
    if (token) {
      console.log('✅ [DEBUG] useSchemaBasedSSO: Token captured immediately on mount:', token.substring(0, 20) + '...');
      ssoTokenRef.current = token;
      
      // Clean up token from URL immediately to prevent React Router from seeing it
      const newUrl = new URL(window.location.href);
      newUrl.searchParams.delete('sso_token');
      window.history.replaceState({}, '', newUrl.toString());
      console.log('🧹 [DEBUG] useSchemaBasedSSO: Token removed from URL immediately');
    } else {
      console.log('ℹ️ [DEBUG] useSchemaBasedSSO: No token in URL on mount');
    }
  }, []); // Run only once on mount

  useEffect(() => {
    async function initAuth() {
      // Prevent multiple token processing
      if (tokenProcessedRef.current) {
        console.log('🔍 [DEBUG] initAuth: Token already processed, skipping');
        return;
      }

      console.log('🔍 [DEBUG] initAuth: Starting authentication check...');

      try {
        // Use the token we captured on mount (not from current URL, which may have been stripped)
        const token = ssoTokenRef.current;
        
        // If we have an SSO token, process it FIRST (even if there's an existing session)
        // This ensures we use the fresh session from the Hub
        if (token) {
          console.log('✅ [DEBUG] initAuth: SSO token found (from ref), processing...');
          console.log('🔍 [DEBUG] initAuth: Token value:', token.substring(0, 20) + '...');

          // Mark as processed BEFORE exchange (prevents race conditions)
          tokenProcessedRef.current = true;
          ssoTokenRef.current = null; // Clear the token ref after marking as processed
          console.log('🔍 [DEBUG] initAuth: Marked token as processed, starting exchange...');

          // Exchange token for session (this will replace any existing session)
          await exchangeSSOTokenAndSetSession(token, supabaseClient);
          console.log('✅ [DEBUG] initAuth: Token exchange completed, checking session...');

          const {
            data: { session: newSession },
          } = await supabaseClient.auth.getSession();

          if (newSession) {
            console.log('✅ [DEBUG] initAuth: Session established successfully via SSO');
            setSession(newSession);
            setUser(newSession.user);
            setError(null);
            return;
          } else {
            throw new Error('Failed to establish session after SSO exchange');
          }
        }

        // No SSO token - check for existing session
        console.log('🔍 [DEBUG] initAuth: No SSO token, checking for existing session...');
        const {
          data: { session: existingSession },
        } = await supabaseClient.auth.getSession();

        if (existingSession) {
          console.log('✅ [DEBUG] initAuth: Found existing session, using it');
          setSession(existingSession);
          setUser(existingSession.user);
          tokenProcessedRef.current = true; // Mark as processed
          return;
        }

        console.log('ℹ️ [DEBUG] initAuth: No SSO token and no existing session, user needs to authenticate via Hub');

      } catch (err) {
        console.error('❌ SchemaBasedSSO: Schema-based SSO failed:', err);
        setError(err instanceof Error ? err : new Error('Authentication failed'));
        tokenProcessedRef.current = false; // Allow retry on error
        ssoTokenRef.current = null; // Clear token on error
      } finally {
        setIsLoading(false);
        console.log('🔍 [DEBUG] initAuth: Authentication check complete');
      }
    }

    initAuth();
  }, [supabaseClient]); // Only run once when supabaseClient changes

  // Add listener for auth state changes to keep the session in sync
  useEffect(() => {
    const {
      data: { subscription },
    } = supabaseClient.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabaseClient]);

  return { user, session, isLoading, error };
}
