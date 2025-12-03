import { supabase } from './dbService';

export const ssoReceiver = {
  initialize: () => {
    window.addEventListener('message', handleMessage);
  },
  cleanup: () => {
    window.removeEventListener('message', handleMessage);
  }
};

const handleMessage = async (event: MessageEvent) => {
  // Check for the specific message type expected from the hub
  if (event.data && event.data.type === 'sso-token' && event.data.access_token && event.data.refresh_token) {
    console.log("Received SSO token from hub");
    try {
        const { error } = await supabase.auth.setSession({
          access_token: event.data.access_token,
          refresh_token: event.data.refresh_token
        });
        
        if (error) {
            console.error("Failed to set SSO session:", error.message);
        } else {
            console.log("SSO session set successfully.");
        }
    } catch (err) {
        console.error("Error handling SSO message:", err);
    }
  }
};