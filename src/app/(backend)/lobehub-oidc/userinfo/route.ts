/**
 * Stub for GET ${MARKET_BASE_URL}/lobehub-oidc/userinfo
 * Called by MarketService.getUserInfoWithTrustedClient() with x-lobe-trust-token header.
 * Returns OIDC-style user claims derived from the trust token payload.
 */
import { json, validateRequest } from '@/server/services/marketStub/auth';

export const GET = (req: Request) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { userId, email, name } = auth.payload;
  return json({
    email: email || '',
    name: name || userId,
    sub: userId,
  });
};
