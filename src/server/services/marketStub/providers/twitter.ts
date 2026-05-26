import { createHash, randomBytes } from 'node:crypto';

import type { ProviderDef } from './types';

// PKCE helpers
function base64url(buf: Buffer): string {
  return buf.toString('base64').replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

export function generateCodeVerifier(): string {
  return base64url(randomBytes(32));
}

export function generateCodeChallenge(verifier: string): string {
  return base64url(createHash('sha256').update(verifier).digest());
}

async function twitterFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.twitter.com/2${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Twitter API error ${res.status}: ${await res.text()}`);
  return res.json();
}

const twitter: ProviderDef = {
  authorizeUrl: ({ callbackUrl, scopes, state, codeVerifier }) => {
    const clientId = process.env.TWITTER_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('TWITTER_OAUTH_CLIENT_ID not set');
    if (!codeVerifier) throw new Error('codeVerifier required for Twitter PKCE flow');
    const params = new URLSearchParams({
      client_id: clientId,
      code_challenge: generateCodeChallenge(codeVerifier),
      code_challenge_method: 'S256',
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: scopes.join(' '),
      state,
    });
    return `https://twitter.com/i/oauth2/authorize?${params}`;
  },

  displayName: 'X (Twitter)',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/x.svg',
  id: 'twitter',

  async exchangeCode(code, callbackUrl, codeVerifier) {
    const clientId = process.env.TWITTER_OAUTH_CLIENT_ID;
    const clientSecret = process.env.TWITTER_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('TWITTER_OAUTH_CLIENT_ID/SECRET not set');
    if (!codeVerifier) throw new Error('codeVerifier required');

    const res = await fetch('https://api.twitter.com/2/oauth2/token', {
      body: new URLSearchParams({
        client_id: clientId,
        code,
        code_verifier: codeVerifier,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Twitter token exchange failed: ${await res.text()}`);
    const data: any = await res.json();

    const me: any = await twitterFetch('/users/me', data.access_token);
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      providerUsername: me.data?.username ?? 'X user',
      refreshToken: data.refresh_token,
    };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'post_tweet': {
        const data: any = await twitterFetch('/tweets', accessToken, {
          body: JSON.stringify({ text: args.text }),
          method: 'POST',
        });
        return data.data;
      }
      case 'get_timeline': {
        const me: any = await twitterFetch('/users/me', accessToken);
        return twitterFetch(
          `/users/${me.data.id}/timelines/reverse_chronological?max_results=${args.max_results ?? 10}`,
          accessToken,
        );
      }
      default: {
        throw new Error(`Unknown Twitter tool: ${toolName}`);
      }
    }
  },

  scopes: ['tweet.read', 'tweet.write', 'users.read', 'offline.access'],

  tools: [
    {
      description: 'Post a new tweet on X (Twitter).',
      input_schema: {
        properties: { text: { description: 'Tweet content (max 280 chars)', type: 'string' } },
        required: ['text'],
        type: 'object',
      },
      name: 'post_tweet',
    },
    {
      description: "Get the authenticated user's home timeline.",
      input_schema: {
        properties: {
          max_results: { description: 'Max tweets to return (default 10)', type: 'number' },
        },
        type: 'object',
      },
      name: 'get_timeline',
    },
  ],
};

export default twitter;
