#!/usr/bin/env tsx

/**
 * Setup Development User & Tokens
 *
 * This script automates the setup for standalone development:
 * 1. Creates a test user in Supabase (if not exists)
 * 2. Signs in as that user
 * 3. Generates the necessary .env.local configuration
 *
 * Usage:
 *   npx tsx scripts/setup-dev-user.ts
 */

import { createClient } from '@supabase/supabase-js';

// Default config from your dbService
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://gqnopyppoueycchidehr.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_KEY ||
  'sb_publishable_X5SIUzQz3_kuEd5Uj7oxQQ_wYgO5BYb';

const TEST_EMAIL = 'test@example.com';
const TEST_PASSWORD = 'password123'; // Simple default for dev

async function setup() {
  console.log('🚀 Setting up development environment...\n');
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

  // 1. Try to Sign Up
  console.log(`👤 Attempting to create user: ${TEST_EMAIL}...`);
  let { data, error } = await supabase.auth.signUp({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });

  // 2. If user exists, try to Sign In
  if (error?.message?.includes('already registered') || !data.session) {
    console.log('ℹ️  User exists, signing in...');
    const signIn = await supabase.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });
    
    data = signIn.data;
    error = signIn.error;
  }

  if (error || !data.session) {
    console.error('❌ Authentication failed:', error?.message);
    (process as any).exit(1);
  }

  // 3. Output Configuration
  console.log('\n✅ Success! Development user authenticated.');
  console.log(`   User ID: ${data.user?.id}\n`);
  
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('📋 Create or update your .env.local file with these values:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  
  console.log(`VITE_DEV_ACCESS_TOKEN=${data.session.access_token}`);
  console.log(`VITE_DEV_REFRESH_TOKEN=${data.session.refresh_token}`);
  
  console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('💡 After updating .env.local, restart your dev server to enable');
  console.log('   STANDALONE_DEV mode with real database permissions.');
}

setup().catch(console.error);