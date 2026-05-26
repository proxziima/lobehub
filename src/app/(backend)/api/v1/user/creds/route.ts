/**
 * Stub for GET /api/v1/user/creds — called by market.creds.list tRPC procedure.
 * Returns an empty credential list; the creds vault lives on market.lobehub.com
 * and is not part of this stub. Returning [] prevents the 500 crash.
 */
import { json, validateRequest } from '@/server/services/marketStub/auth';

export const GET = (req: Request) => {
  const auth = validateRequest(req);
  if (!auth.ok) return json({ data: [] });
  return json({ data: [] });
};

export const POST = (req: Request) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;
  return json({ error: 'Creds vault not implemented in local stub' }, 501);
};

export const DELETE = (req: Request) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;
  return json({ error: 'Creds vault not implemented in local stub' }, 501);
};
