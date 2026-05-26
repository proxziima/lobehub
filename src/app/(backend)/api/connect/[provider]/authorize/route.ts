import { randomBytes } from 'node:crypto';

import { json, validateRequest } from '@/server/services/marketStub/auth';
import { generateCodeVerifier, getProvider } from '@/server/services/marketStub/providers';
import { setOAuthState } from '@/server/services/marketStub/store';

export const POST = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return json({ error: `Unknown provider: ${providerId}` }, 404);

  const body = (await req.json().catch(() => ({}))) as { redirect_uri?: string; scopes?: string[] };
  const redirectUri = body.redirect_uri ?? '';
  const scopes = body.scopes ?? provider.scopes;

  const state = randomBytes(16).toString('hex');
  const codeVerifier = providerId === 'twitter' ? generateCodeVerifier() : undefined;

  const appUrl = process.env.APP_URL ?? req.headers.get('origin') ?? 'http://localhost:3000';
  const callbackUrl = `${appUrl}/api/market-stub-callback/${providerId}`;

  setOAuthState(state, {
    codeVerifier,
    createdAt: Date.now(),
    provider: providerId,
    redirectUri,
    userId: auth.payload.userId,
  });

  let authorizeUrl: string;
  try {
    authorizeUrl = provider.authorizeUrl({ callbackUrl, codeVerifier, scopes, state });
  } catch (err: any) {
    return json({ error: err.message }, 500);
  }

  return json({ authorize_url: authorizeUrl, code: state, expires_in: 600 });
};
