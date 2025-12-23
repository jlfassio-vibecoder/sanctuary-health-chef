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
          console.log('🔍 useFirebaseSSOAuth: Checking for SSO token...');
          const token = getSSOTokenFromUrl();
          console.log('🔍 useFirebaseSSOAuth: Token result:', token ? `Found (length: ${token.length})` : 'Not found');
          
          if (token) {
            console.log('✅ useFirebaseSSOAuth: Token found, proceeding with exchange...');
            // Exchange SSO exchange token for custom token
            let tokenData;
            try {
              tokenData = await exchangeFirebaseSSOToken(token);
            } catch (exchangeError) {
              // Handle exchange errors with specific messages
              if (exchangeError instanceof Error) {
                if (exchangeError.message.includes('Invalid or expired')) {
                  throw new Error('SSO token is invalid or has expired. Please return to the Hub and try again.');
                } else if (exchangeError.message.includes('Server error')) {
                  throw new Error('Unable to verify SSO token. Please try again later.');
                }
              }
              throw exchangeError;
            }
            
            console.log('✅ SSO token exchanged, user_id:', tokenData.user_id);
            
            // Sign in with the custom token to establish Firebase Auth session
            try {
              console.log('🔐 Establishing Firebase Auth session with custom token...');
              const userCredential = await signInWithCustomToken(auth, tokenData.custom_token);
              console.log('✅ Firebase Auth session established:', userCredential.user.email);
              // onAuthStateChanged will update the user state automatically
            } catch (signInError) {
              console.error('❌ Failed to sign in with custom token:', signInError);
              throw new Error('Failed to authenticate. Please return to the Hub and try again.');
            }
          } else {
            console.log('ℹ️ useFirebaseSSOAuth: No SSO token found, user needs to authenticate via Hub');
          }
        } catch (err) {
          const errorMessage = err instanceof Error 
            ? err.message 
            : 'Authentication failed. Please return to the Hub and try again.';
          setError(new Error(errorMessage));
          console.error('❌ Firebase SSO failed:', err);
        } finally {
          setIsLoading(false);
        }
      } else {
        console.log('✅ useFirebaseSSOAuth: User already authenticated');
        setIsLoading(false);
      }

      return () => unsubscribe();
    }

    initAuth();
  }, []);

  return { user, isLoading, error };
}


