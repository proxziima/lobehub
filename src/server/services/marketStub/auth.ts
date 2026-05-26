/**
 * Trust-token auth helper for Market stub route handlers.
 * Reads credentials from env and delegates to the same validator used by the CLI.
 */

import {
  type TrustTokenPayload,
  validateTrustToken,
} from '../../../../scripts/marketStub/trustToken';

export interface AuthResult {
  ok: true;
  payload: TrustTokenPayload;
}
export interface AuthFail {
  ok: false;
  response: Response;
}

function unauthorized(reason: string): AuthFail {
  return {
    ok: false,
    response: new Response(JSON.stringify({ error: 'Unauthorized', reason }), {
      headers: { 'Content-Type': 'application/json' },
      status: 401,
    }),
  };
}

export function validateRequest(req: Request): AuthResult | AuthFail {
  const clientId = process.env.MARKET_TRUSTED_CLIENT_ID;
  const secret = process.env.MARKET_TRUSTED_CLIENT_SECRET;

  if (!clientId || !secret) {
    return unauthorized(
      'Market stub not configured (missing MARKET_TRUSTED_CLIENT_ID or MARKET_TRUSTED_CLIENT_SECRET)',
    );
  }

  const tokenHeader = req.headers.get('x-lobe-trust-token');
  if (!tokenHeader) {
    return unauthorized('Missing x-lobe-trust-token header');
  }

  const result = validateTrustToken(tokenHeader, clientId, secret);
  if (!result.ok) {
    return unauthorized(result.reason);
  }

  return { ok: true, payload: result.payload };
}

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    headers: { 'Content-Type': 'application/json' },
    status,
  });
}
