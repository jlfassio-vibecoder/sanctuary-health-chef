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
              
              // Note: Firebase Auth doesn't support setting session from ID token on client
              // You'll need to use Firebase Custom Tokens (server-side) or verify the token
              // For now, we'll use the ID token to authenticate
              // In production, implement server-side custom token generation
              
              // TODO: Implement proper Firebase Auth session establishment
              // This may require a server endpoint that verifies the ID token and returns a custom token
              // For now, the user_id is available but we need to establish a Firebase Auth session
              // Option A: Create server endpoint that returns custom token, then use:
              // const customToken = await fetchCustomTokenFromServer(tokenData.id_token);
              // await signInWithCustomToken(auth, customToken);
              
              // Option B: Use ID token for Firestore access (less secure, not recommended for production)
              // The Firestore rules would need to allow access based on the ID token
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


