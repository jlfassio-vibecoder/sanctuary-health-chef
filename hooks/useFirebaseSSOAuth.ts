import { useState, useEffect, useRef } from 'react';
import { auth } from '../src/lib/firebase';
import { exchangeFirebaseSSOToken, getSSOTokenFromUrl } from '../services/hub/FirebaseSSO';
import { signInWithCustomToken, onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';

interface UseFirebaseSSOAuthResult {
  user: User | null;
  isLoading: boolean;
  error: Error | null;
}

export function useFirebaseSSOAuth(): UseFirebaseSSOAuthResult {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);
  const tokenProcessedRef = useRef(false);

  useEffect(() => {
    async function initAuth() {
      // Check for existing session first
      const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
        if (currentUser && !tokenProcessedRef.current) {
          setUser(currentUser);
          setIsLoading(false);
          tokenProcessedRef.current = true;
        }
      });

      // If no session, check for SSO token
      if (!auth.currentUser) {
        try {
          const token = getSSOTokenFromUrl();
          
          if (token) {
            // Remove token from URL
            const url = new URL(window.location.href);
            url.searchParams.delete('sso_token');
            window.history.replaceState({}, document.title, url.toString());

            // Exchange token for Firebase ID token
            const tokenData = await exchangeFirebaseSSOToken(token);
            
            if (tokenData) {
              console.log('SSO token exchanged, user_id:', tokenData.user_id);
              
              // Establish Firebase Auth session using custom token if available
              if (tokenData.custom_token) {
                try {
                  console.log('🔐 Establishing Firebase Auth session with custom token...');
                  const userCredential = await signInWithCustomToken(auth, tokenData.custom_token);
                  console.log('✅ Firebase Auth session established:', userCredential.user.email);
                  // onAuthStateChanged will update the user state automatically
                } catch (customTokenError) {
                  console.error('❌ Failed to sign in with custom token:', customTokenError);
                  setError(customTokenError instanceof Error ? customTokenError : new Error('Failed to establish Firebase Auth session'));
                }
              } else {
                // No custom token available - this is a known limitation
                // The Hub should provide a custom_token in the SSO token data for production use
                // Without it, we cannot establish a Firebase Auth session on the client side
                console.warn('⚠️ SSO token does not include custom_token. Firebase Auth session cannot be established.');
                console.warn('⚠️ This is a known limitation. For production, the Hub must provide a custom_token.');
                console.warn('⚠️ Alternative: Implement a server endpoint that verifies the ID token and returns a custom token.');
                setError(new Error('SSO authentication incomplete: custom_token not provided. Server-side custom token generation required.'));
              }
            }
          }
        } catch (err) {
          setError(err instanceof Error ? err : new Error('SSO authentication failed'));
          console.error('SSO auth error:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        setIsLoading(false);
      }

      return () => unsubscribe();
    }

    initAuth();
  }, []);

  return { user, isLoading, error };
}


