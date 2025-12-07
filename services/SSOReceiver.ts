import * as jose from 'jose';

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
  token: string;
  access_token: string;
  refresh_token: string;
  user: {
    id: string;
    email: string;
    tier?: string;
    app_access?: Record<string, boolean>;
  };
}

interface DecodedToken {
  sub: string;
  email: string;
  tier?: string;
  app_access?: Record<string, boolean>;
  iss?: string;
  aud?: string | string[];
  exp?: number;
}

class SSOReceiver {
  private messageListener: ((event: MessageEvent) => void) | null = null;
  private isInitialized = false;

  /**
   * Initialize SSO receiver to listen for tokens from Hub
   */
  initialize(onTokenReceived: (tokenData: SSOTokenData) => void) {
    if (this.isInitialized) {
      console.warn('🔐 SSOReceiver: Already initialized');
      return;
    }

    console.log('🔐 SSOReceiver: Initializing...');

    this.messageListener = async (event: MessageEvent) => {
      // Security: Only accept messages from Hub origin
      const hubUrl = getEnvVar('VITE_HUB_URL') || 'http://localhost:5175';
      const allowedOrigins = [
        hubUrl,
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

        const tokenData = event.data.payload;

        if (!tokenData || !tokenData.token) {
          console.error('❌ SSOReceiver: Invalid token data received');
          return;
        }

        // Verify token before processing
        const userData = await this.verifyAndDecodeToken(tokenData.token);

        if (!userData) {
          console.error('❌ SSOReceiver: Token verification failed');
          return;
        }

        console.log('✅ SSOReceiver: Token verified successfully for user:', userData.email);

        // Store in localStorage for persistence
        try {
          localStorage.setItem('sso_token', tokenData.token);
          localStorage.setItem('sso_user', JSON.stringify(userData));
          if (tokenData.access_token) {
            localStorage.setItem('sso_access_token', tokenData.access_token);
          }
          if (tokenData.refresh_token) {
            localStorage.setItem('sso_refresh_token', tokenData.refresh_token);
          }
        } catch (e) {
          console.warn('⚠️ SSOReceiver: Could not store token in localStorage:', e);
        }

        // Call the callback with full token data
        onTokenReceived({
          token: tokenData.token,
          access_token: tokenData.access_token,
          refresh_token: tokenData.refresh_token,
          user: {
            id: userData.sub,
            email: userData.email,
            tier: userData.tier,
            app_access: userData.app_access,
          }
        });
      }
    };

    window.addEventListener('message', this.messageListener);
    this.isInitialized = true;

    console.log('✅ SSOReceiver: Listening for SSO tokens from Hub');
  }

  /**
   * Verify and decode JWT token using jose library
   */
  async verifyAndDecodeToken(token: string): Promise<DecodedToken | null> {
    try {
      const jwtSecret = getEnvVar('VITE_SUPABASE_JWT_SECRET');

      if (!jwtSecret) {
        console.error('❌ SSOReceiver: VITE_SUPABASE_JWT_SECRET not configured');
        return null;
      }

      console.log('🔐 SSOReceiver: Verifying token signature...');

      // Convert secret to Uint8Array
      const secret = new TextEncoder().encode(jwtSecret);

      // Verify JWT signature with jose
      const { payload } = await jose.jwtVerify(token, secret, {
        issuer: 'fitcopilot-hub',
        audience: 'fitcopilot-apps',
      });

      console.log('✅ SSOReceiver: Token signature verified');

      // Extract user data from payload
      const userData: DecodedToken = {
        sub: payload.sub || '',
        email: (payload.email as string) || '',
        tier: payload.tier as string | undefined,
        app_access: payload.app_access as Record<string, boolean> | undefined,
        iss: payload.iss,
        aud: payload.aud,
        exp: payload.exp,
      };

      return userData;
    } catch (error) {
      console.error('❌ SSOReceiver: Token verification failed:', error);
      return null;
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
   * Check if SSO token exists in localStorage
   */
  hasSSOToken(): boolean {
    try {
      return !!localStorage.getItem('sso_token');
    } catch (e) {
      return false;
    }
  }

  /**
   * Get stored SSO user data
   */
  getStoredUser(): DecodedToken | null {
    try {
      const userData = localStorage.getItem('sso_user');
      return userData ? JSON.parse(userData) : null;
    } catch (e) {
      return null;
    }
  }

  /**
   * Clear SSO data from localStorage
   */
  clearSSOData() {
    try {
      localStorage.removeItem('sso_token');
      localStorage.removeItem('sso_user');
      localStorage.removeItem('sso_access_token');
      localStorage.removeItem('sso_refresh_token');
      console.log('🔐 SSOReceiver: SSO data cleared');
    } catch (e) {
      console.warn('⚠️ SSOReceiver: Could not clear SSO data:', e);
    }
  }
}

// Export singleton instance
export const ssoReceiver = new SSOReceiver();
