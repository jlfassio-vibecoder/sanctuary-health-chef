import { supabase } from './dbService';

export const ssoReceiver = {
  initialize: () => {
    if (typeof window === 'undefined') return;
    
    window.addEventListener('message', handleMessage);
    
    // Handshake: Notify the Hub (parent window) that we are ready to receive the token.
    // This is crucial for iframe integrations.
    if (window.parent !== window) {
        console.log("🔐 SSOReceiver: Sending SSO_READY to parent");
        window.parent.postMessage({ type: 'SSO_READY', timestamp: Date.now() }, '*');
    }
  },
  cleanup: () => {
    if (typeof window === 'undefined') return;
    window.removeEventListener('message', handleMessage);
  }
};

const handleMessage = async (event: MessageEvent) => {
  const message = event.data;
  if (!message || !message.type) return;

  // 1. Handle 'Hub' Standard Protocol (SSO_TOKEN)
  if (message.type === 'SSO_TOKEN' && message.payload?.token) {
    console.log("🔐 Received SSO_TOKEN from Hub");
    try {
        // The Hub sends 'token' (access_token). 
        // We use it to establish a Supabase session.
        const accessToken = message.payload.token;
        // Use provided refresh token or fallback to access token (for short-lived sessions)
        const refreshToken = message.payload.refresh_token || accessToken;

        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });
        
        if (error) {
            console.error("🔐 Failed to set SSO session:", error.message);
        } else {
            console.log("🔐 SSO session set successfully.");
        }
    } catch (err) {
        console.error("🔐 Error handling SSO message:", err);
    }
    return;
  }

  // 2. Handle Legacy/Simple Protocol (sso-token)
  // This supports the simple format initially provided
  if (message.type === 'sso-token' && message.access_token) {
    console.log("🔐 Received sso-token (legacy)");
    try {
        const { error } = await supabase.auth.setSession({
          access_token: message.access_token,
          refresh_token: message.refresh_token || message.access_token
        });
        
        if (error) {
            console.error("🔐 Failed to set SSO session (legacy):", error.message);
        }
    } catch (err) {
        console.error("🔐 Error handling legacy SSO:", err);
    }
  }
};