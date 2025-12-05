import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// Import chef registration
import { chefRegistry } from './src/services/chef/ChefRegistry';
import { CHEF_PERSONAS } from './src/services/chef/chefPersonas';

// Check for Gemini API key
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

if (geminiApiKey) {
  console.log('🔑 Gemini API key found, registering AI chefs...');
  
  // Register all chef personas
  CHEF_PERSONAS.forEach((chef) => {
    chefRegistry.register(chef);
  });
  
  console.log(`✅ Successfully registered ${chefRegistry.getCount()} AI chef(s)`);
  
  // Log all registered chefs
  console.log('📊 Total chefs registered:', chefRegistry.getCount());
  chefRegistry.getAllChefs().forEach((chef) => {
    console.log(`   - ${chef.name} (ID: ${chef.id})`);
  });
} else {
  console.warn('⚠️ Gemini API key not found. AI chefs will not be available.');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);