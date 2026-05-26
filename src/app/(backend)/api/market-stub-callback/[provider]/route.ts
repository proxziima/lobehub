/**
 * OAuth callback endpoint. Third-party providers redirect here after consent.
 * We exchange the code for a token, persist the connection, then 302 to the
 * app's /oauth/callback/success page which posts LOBEHUB_SKILL_AUTH_SUCCESS
 * to the opener and closes the popup.
 */
import { getProvider } from '@/server/services/marketStub/providers';
import { popOAuthState, setConnection } from '@/server/services/marketStub/store';

export const GET = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider: providerId } = await params;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const appUrl = process.env.APP_URL ?? `${url.protocol}//${url.host}`;

  if (error) {
    return Response.redirect(
      `${appUrl}/oauth/callback/error?error=${encodeURIComponent(error)}&provider=${providerId}`,
      302,
    );
  }

  if (!code || !state) {
    return Response.redirect(
      `${appUrl}/oauth/callback/error?error=missing_code&provider=${providerId}`,
      302,
    );
  }

  const stateRow = popOAuthState(state);
  if (!stateRow) {
    return Response.redirect(
      `${appUrl}/oauth/callback/error?error=invalid_or_expired_state&provider=${providerId}`,
      302,
    );
  }

  const provider = getProvider(providerId);
  if (!provider) {
    return Response.redirect(
      `${appUrl}/oauth/callback/error?error=unknown_provider&provider=${providerId}`,
      302,
    );
  }

  const callbackUrl = `${appUrl}/api/market-stub-callback/${providerId}`;

  try {
    const tokenData = await provider.exchangeCode(code, callbackUrl, stateRow.codeVerifier);
    setConnection({
      accessToken: tokenData.accessToken,
      expiresAt: tokenData.expiresIn ? Date.now() + tokenData.expiresIn * 1000 : null,
      providerId,
      providerUsername: tokenData.providerUsername,
      refreshToken: tokenData.refreshToken,
      scopes: provider.scopes,
      userId: stateRow.userId,
    });
  } catch (err: any) {
    console.error(`[market-stub] OAuth exchange failed for ${providerId}:`, err.message);
    return Response.redirect(
      `${appUrl}/oauth/callback/error?error=${encodeURIComponent(err.message)}&provider=${providerId}`,
      302,
    );
  }

  // Redirect popup back to the app success page (app reads `provider` param and postMessages SUCCESS)
  const successUrl =
    stateRow.redirectUri || `${appUrl}/oauth/callback/success?provider=${providerId}`;
  return Response.redirect(successUrl, 302);
};
