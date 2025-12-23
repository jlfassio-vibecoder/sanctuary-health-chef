/**
 * Firebase SSO Service
 * Handles SSO authentication via URL-based token exchange with Firebase
 *
 * Flow:
 * 1. Hub generates token and stores in Firestore sso_tokens collection
 * 2. Hub redirects to Chef with ?sso_token=xxx in URL
 * 3. Chef reads token from URL and exchanges it for Firebase Custom Token via Hub API
 * 4. Chef uses custom token to authenticate with Firebase Auth
 */

export interface FirebaseSSOTokenData {
  user_id: string;
  id_token?: string;
  custom_token?: string; // Firebase custom token for client-side authentication
  expires_at: string;
}

/**
 * Gets SSO token from URL parameter
 * Also removes the token from URL for security
 */
export function getSSOTokenFromUrl(): string | null {
  if (typeof window === 'undefined') return null;

  const params = new URLSearchParams(window.location.search);
  const token = params.get('sso_token');

  console.log('🔍 getSSOTokenFromUrl: URL search params:', window.location.search);
  console.log('🔍 getSSOTokenFromUrl: Extracted token:', token ? `Found (length: ${token.length})` : 'Not found');

  if (token) {
    // Clean URL to remove token from browser history
    const url = new URL(window.location.href);
    url.searchParams.delete('sso_token');
    window.history.replaceState({}, document.title, url.toString());
    console.log('🧹 getSSOTokenFromUrl: Token cleaned from URL');
  }

  return token;
}

/**
 * Exchanges SSO token for Firebase Custom Token
 * 
 * This calls the Hub app's backend API to exchange the SSO exchange token
 * (UUID from URL) for a Firebase Custom Token that can be used to authenticate.
 * 
 * @param token - SSO exchange token (UUID) from URL parameter
 * @returns Token data including custom_token for authentication
 * @throws Error if token exchange fails
 */
export async function exchangeFirebaseSSOToken(
  token: string
): Promise<FirebaseSSOTokenData> {
  // Validate token is provided
  if (!token || token.trim() === '') {
    throw new Error('Missing token');
  }

  // Get Hub URL from environment variable
  const hubUrl = import.meta.env.VITE_HUB_URL || 'http://localhost:5175';
  const apiUrl = `${hubUrl}/api/exchange-firebase-sso-token`;

  try {
    console.log('🔐 FirebaseSSO: Exchanging SSO token via Hub API...', { tokenLength: token.length });

    // Call backend API to exchange SSO token for custom token
    // Note: Hub API expects 'token' field, not 'sso_token'
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ token: token }),
    });

    if (!response.ok) {
      let errorData: { error?: string } = { error: 'Unknown error' };
      try {
        errorData = await response.json();
      } catch {
        // Response body is not JSON, use default error
      }
      
      if (response.status === 404) {
        throw new Error('Invalid or expired SSO token');
      } else if (response.status === 400) {
        throw new Error(errorData.error || 'SSO token has expired');
      } else if (response.status === 401) {
        throw new Error('Invalid ID token in SSO token');
      } else if (response.status >= 500) {
        throw new Error(errorData.error || 'Server error occurred. Please try again later.');
      } else {
        throw new Error(errorData.error || `Request failed with status ${response.status}`);
      }
    }

    const data = await response.json();
    
    // Hub API returns customToken (camelCase) or custom_token (snake_case)
    const customToken = data.customToken || data.custom_token;
    // user_id may not be in response - we'll get it from the authenticated user after sign-in
    const userId = data.user_id || data.userId || '';
    
    if (!customToken) {
      console.error('❌ FirebaseSSO: Invalid response data:', data);
      throw new Error('Invalid response from server: missing customToken');
    }

    const expiresAt = data.expires_at || data.expiresAt
      ? new Date(data.expires_at || data.expiresAt) 
      : new Date(Date.now() + 60 * 60 * 1000); // Default 1 hour

    console.log('✅ FirebaseSSO: Successfully exchanged SSO token for custom token');

    return {
      user_id: userId, // May be empty, will be populated from authenticated user
      id_token: '', // Not needed after exchange
      custom_token: customToken,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    // Re-throw if it's already an Error with a message
    if (error instanceof Error) {
      console.error('❌ FirebaseSSO: Failed to exchange SSO token:', error.message);
      throw error;
    }
    // Handle network errors and other unexpected errors
    console.error('❌ FirebaseSSO: Failed to exchange SSO token:', error);
    throw new Error('Network error: Unable to connect to authentication server');
  }
}


