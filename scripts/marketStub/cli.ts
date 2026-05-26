#!/usr/bin/env bun
/**
 * Market stub CLI.
 *
 * Usage:
 *   bun scripts/marketStub/cli.ts init            — generate new credentials and print .env block
 *   bun scripts/marketStub/cli.ts inspect <token> — decrypt a trust token (for debugging)
 */

import { generateCredentials, printDotEnvBlock, validateTrustToken } from './trustToken';

const [, , cmd, arg] = process.argv;

if (cmd === 'init') {
  const creds = generateCredentials();
  console.log('\n# Paste into your .env file:\n');
  console.log(printDotEnvBlock(creds));
  console.log('\n# Also add per-provider OAuth secrets (see plan for each provider):');
  console.log('# NOTION_OAUTH_CLIENT_ID=...');
  console.log('# NOTION_OAUTH_CLIENT_SECRET=...');
  console.log('# GITHUB_OAUTH_CLIENT_ID=...');
  console.log('# GITHUB_OAUTH_CLIENT_SECRET=...');
  console.log('# LINEAR_OAUTH_CLIENT_ID=...');
  console.log('# LINEAR_OAUTH_CLIENT_SECRET=...');
  console.log('# MICROSOFT_OAUTH_CLIENT_ID=...');
  console.log('# MICROSOFT_OAUTH_CLIENT_SECRET=...');
  console.log('# TWITTER_OAUTH_CLIENT_ID=...');
  console.log('# TWITTER_OAUTH_CLIENT_SECRET=...');
  console.log('# VERCEL_OAUTH_CLIENT_ID=...');
  console.log('# VERCEL_OAUTH_CLIENT_SECRET=...\n');
} else if (cmd === 'inspect') {
  if (!arg) {
    console.error('Usage: bun scripts/marketStub/cli.ts inspect <base64-token>');
    process.exit(1);
  }
  const clientId = process.env.MARKET_TRUSTED_CLIENT_ID;
  const secret = process.env.MARKET_TRUSTED_CLIENT_SECRET;
  if (!clientId || !secret) {
    console.error('MARKET_TRUSTED_CLIENT_ID and MARKET_TRUSTED_CLIENT_SECRET must be set in env');
    process.exit(1);
  }
  const result = validateTrustToken(arg, clientId, secret);
  if (result.ok) {
    console.log('\n✓ Token valid\n');
    console.log(JSON.stringify(result.payload, null, 2));
  } else {
    console.error(`\n✗ Token invalid: ${result.reason}\n`);
    process.exit(1);
  }
} else {
  console.log('Usage:');
  console.log('  bun scripts/marketStub/cli.ts init               — generate credentials');
  console.log('  bun scripts/marketStub/cli.ts inspect <token>    — inspect a trust token');
  process.exit(1);
}
