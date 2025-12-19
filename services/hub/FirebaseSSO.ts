/**
 * Firebase SSO Service
 * Handles SSO authentication via URL-based token exchange with Firebase
 *
 * Flow:
 * 1. Hub generates token and stores in Firestore sso_tokens collection
 * 2. Hub redirects to Chef with ?sso_token=xxx in URL
 * 3. Chef reads token from URL and exchanges it for Firebase ID token
 * 4. Chef uses ID token to authenticate (or exchanges for custom token server-side)
 */

import { db } from '../../src/lib/firebase';
import { doc, getDoc, deleteDoc } from 'firebase/firestore';

export interface FirebaseSSOTokenData {
  user_id: string;
  id_token?: string;
  expires_at: string;
}

/**
 * Gets SSO token from URL parameter
 */
export function getSSOTokenFromUrl(): string | null {
  const params = new URLSearchParams(window.location.search);
  return params.get('sso_token');
}

/**
 * Exchanges SSO token for Firebase ID token
 *
 * Queries the Firestore sso_tokens collection to retrieve token data,
 * then returns the user_id and ID token.
 *
 * @param token - The SSO token from URL parameter
 * @returns SSO token data with user_id and ID token, or null if exchange fails
 */
export async function exchangeFirebaseSSOToken(
  token: string,
): Promise<FirebaseSSOTokenData | null> {
  try {
    console.log('🔐 FirebaseSSO: Exchanging SSO token...');

    // Query Firestore sso_tokens collection
    const tokenDocRef = doc(db, 'sso_tokens', token);
    const tokenDoc = await getDoc(tokenDocRef);

    if (!tokenDoc.exists()) {
      console.error('🔐 FirebaseSSO: Token not found in Firestore');
      return null;
    }

    const tokenData = tokenDoc.data();

    // Validate required fields
    if (!tokenData.user_id) {
      console.error('🔐 FirebaseSSO: Missing user_id in token data');
      return null;
    }

    // Check if token is expired (tokens expire after 5 minutes)
    const expiresAt = tokenData.expires_at?.toDate?.() || new Date(tokenData.expires_at);
    const now = new Date();

    if (now > expiresAt) {
      console.error('🔐 FirebaseSSO: Token has expired');
      // Delete expired token
      await deleteDoc(tokenDocRef);
      return null;
    }

    console.log('✅ FirebaseSSO: Token found and valid');

    // Delete the token after successful exchange (one-time use)
    try {
      await deleteDoc(tokenDocRef);
      console.log('🗑️ FirebaseSSO: Token deleted from Firestore');
    } catch (deleteError) {
      console.warn('⚠️ FirebaseSSO: Failed to delete token:', deleteError);
    }

    // Return token data
    return {
      user_id: tokenData.user_id,
      id_token: tokenData.id_token,
      expires_at: expiresAt.toISOString(),
    };
  } catch (error) {
    console.error('🔐 FirebaseSSO: Error exchanging token:', error);
    return null;
  }
}


