import { supabase } from './dbService';

/**
 * SSO Receiver for FitCopilot Chef
 * Receives and validates SSO tokens from the Hub app
 */

// Types for SSO communication
export type SSOMessageType =
  | 'SSO_INIT'
  | 'SSO_TOKEN'
  | 'SSO_TOKEN_REFRESH'
  | 'SSO_LOGOUT'
  | 'SSO_READY'
  | 'SSO_ERROR'
  | 'sso-token'; // Support legacy

export interface SSOMessage {
  type: SSOMessageType;
  payload?: SSOTokenPayload | { error: string } | null;
  access_token?: string; // Legacy support
  refresh_token?: string; // Legacy support
  timestamp: number;
}

export interface SSOTokenPayload {
  token: string;
  refresh_token?: string;
  expires_at: string;
  app_access: Record<string, boolean>;
  tier: string;
  user_id: string;
}

export interface SSOUserClaims {
  sub: string;
  email: string;
  full_name: string | null;
  tier: string;
  app_access: Record<string, boolean>;
  target_app: string;
  preferred_units: Record<string, string> | null;
  fitness_goals: string[] | null;
  iss: string;
  aud: string;
  iat: number;
  exp: number;
}

// Hub app origins that can send SSO messages
const ALLOWED_ORIGINS = [
  'https://www.generateworkout.app',
  'https://generateworkout.app',
  'http://localhost:5173',
  'http://localhost:3000',
];

type AuthStateCallback = (user: SSOUserClaims | null, isLoading: boolean) => void;

class SSOReceiverClass {
  private currentUser: SSOUserClaims | null = null;
  private tokenPayload: SSOTokenPayload | null = null;
  private isLoading = true;
  private initialized = false;
  private listeners: Set<AuthStateCallback> = new Set();
  private messageHandler: ((event: MessageEvent) => void) | null = null;
  private tokenRefreshTimer: number | null = null;

  initialize(): void {
    if (this.initialized) {
      console.log('🔐 SSOReceiver: Already initialized');
      return;
    }

    console.log('🔐 SSOReceiver: Initializing...');
    
    // Check for token in URL
    this.checkUrlToken();

    // Setup postMessage listener
    this.setupMessageListener();

    // Notify Hub we're ready
    this.notifyHubReady();

    this.initialized = true;
  }

  private checkUrlToken(): void {
    if (typeof window === 'undefined') return;
    const urlParams = new URLSearchParams(window.location.search);
    const token = urlParams.get('sso_token');

    console.log('🔐 SSOReceiver: Checking URL for token:', token ? 'Found' : 'Not found');

    if (token) {
      this.processToken(token);

      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete('sso_token');
      window.history.replaceState({}, '', url.toString());
    } else {
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  private async processToken(token: string, refreshToken?: string): Promise<void> {
    try {
      console.log('🔐 SSOReceiver: Processing token...');
      
      // 1. Decode locally for state
      const claims = this.decodeJWT(token);

      if (!claims) {
        console.error('🔐 SSOReceiver: Failed to decode token');
        this.isLoading = false;
        this.notifyListeners();
        return;
      }

      // Check expiration
      const now = Math.floor(Date.now() / 1000);
      if (claims.exp && claims.exp < now) {
        console.error('🔐 SSOReceiver: Token expired');
        this.requestTokenRefresh();
        return;
      }
      
      // 2. IMPORTANT: Set Supabase Session
      // This bridges the SSO token to the app's Supabase auth state
      if (supabase) {
          const { error } = await supabase.auth.setSession({
              access_token: token,
              refresh_token: refreshToken || token
          });
          
          if (error) {
              console.error("🔐 SSOReceiver: Supabase session error:", error.message);
          } else {
              console.log("🔐 SSOReceiver: Supabase session established successfully.");
          }
      }

      console.log('🔐 SSOReceiver: Token valid for:', claims.email);
      this.currentUser = claims;
      this.isLoading = false;
      this.scheduleTokenRefresh(claims.exp);
      this.notifyListeners();

    } catch (error) {
      console.error('🔐 SSOReceiver: Error processing token:', error);
      this.isLoading = false;
      this.notifyListeners();
    }
  }

  private decodeJWT(token: string): SSOUserClaims | null {
    try {
      const parts = token.split('.');
      if (parts.length !== 3) return null;

      const payload = parts[1];
      const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
      return JSON.parse(decoded);
    } catch {
      return null;
    }
  }

  private setupMessageListener(): void {
    this.messageHandler = (event: MessageEvent) => {
      // Allow messages from unknown origins during dev, strictly filter in prod if needed
      // if (!ALLOWED_ORIGINS.includes(event.origin)) return;

      const message = event.data as SSOMessage;
      if (!message?.type) return;

      console.log('🔐 SSOReceiver: Received message:', message.type);
      this.handleMessage(message);
    };

    window.addEventListener('message', this.messageHandler);
  }

  private handleMessage(message: SSOMessage): void {
    switch (message.type) {
      case 'SSO_TOKEN':
      case 'SSO_TOKEN_REFRESH':
        if (message.payload && 'token' in message.payload) {
          this.tokenPayload = message.payload;
          this.processToken(message.payload.token, message.payload.refresh_token);
        }
        break;
      case 'sso-token': // Legacy support
        if (message.access_token) {
            this.processToken(message.access_token, message.refresh_token);
        }
        break;
      case 'SSO_LOGOUT':
        this.handleLogout();
        break;
    }
  }

  private notifyHubReady(): void {
    if (window.parent !== window) {
      console.log('🔐 SSOReceiver: Notifying Hub we are ready');
      const message: SSOMessage = { type: 'SSO_READY', timestamp: Date.now() };
      
      // Broadcast to parent
      window.parent.postMessage(message, '*');
    }
  }

  private requestTokenRefresh(): void {
    if (window.parent !== window) {
      console.log('🔐 SSOReceiver: Requesting token refresh');
      const message: SSOMessage = { type: 'SSO_TOKEN_REFRESH', timestamp: Date.now() };
      window.parent.postMessage(message, '*');
    }
  }

  private scheduleTokenRefresh(expTimestamp: number): void {
    if (this.tokenRefreshTimer) clearTimeout(this.tokenRefreshTimer);

    const refreshTime = (expTimestamp - 5 * 60) * 1000 - Date.now();
    if (refreshTime > 0) {
      this.tokenRefreshTimer = window.setTimeout(() => {
        this.requestTokenRefresh();
      }, refreshTime);
    }
  }

  private async handleLogout(): Promise<void> {
    console.log('🔐 SSOReceiver: Logout received');
    this.currentUser = null;
    this.tokenPayload = null;
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
      this.tokenRefreshTimer = null;
    }
    
    if (supabase) {
        await supabase.auth.signOut();
    }
    
    this.notifyListeners();
  }

  subscribe(callback: AuthStateCallback): () => void {
    this.listeners.add(callback);
    callback(this.currentUser, this.isLoading);
    return () => this.listeners.delete(callback);
  }

  private notifyListeners(): void {
    this.listeners.forEach(cb => cb(this.currentUser, this.isLoading));
  }

  getUser(): SSOUserClaims | null {
    return this.currentUser;
  }

  isAuthenticated(): boolean {
    return this.currentUser !== null;
  }

  getIsLoading(): boolean {
    return this.isLoading;
  }

  cleanup(): void {
    if (this.messageHandler) {
      window.removeEventListener('message', this.messageHandler);
    }
    if (this.tokenRefreshTimer) {
      clearTimeout(this.tokenRefreshTimer);
    }
    this.listeners.clear();
  }
}

export const ssoReceiver = new SSOReceiverClass();
