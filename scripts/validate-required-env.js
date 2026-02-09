#!/usr/bin/env node

const requiredVars = (process.env.REQUIRED_EXPO_PUBLIC_VARS || '')
  .split(',')
  .map((name) => name.trim())
  .filter(Boolean);

if (requiredVars.length === 0) {
  console.error('[CI] REQUIRED_EXPO_PUBLIC_VARS is empty.');
  console.error('[CI] Set REQUIRED_EXPO_PUBLIC_VARS to a comma-separated list of required variable names.');
  process.exit(1);
}

const missingVars = requiredVars.filter((name) => {
  const value = process.env[name];
  return typeof value !== 'string' || value.trim().length === 0;
});

if (missingVars.length > 0) {
  console.error(`[CI] Missing required environment variables: ${missingVars.join(', ')}`);
  console.error('[CI] Configure the corresponding GitHub secrets before re-running this workflow.');
  process.exit(1);
}

console.log(`[CI] Required environment variables are set: ${requiredVars.join(', ')}`);
