import { json, validateRequest } from '@/server/services/marketStub/auth';
import { PROVIDERS } from '@/server/services/marketStub/providers';
import { listConnectionsForUser } from '@/server/services/marketStub/store';

export const GET = (req: Request) => {
  // lobehubSkillBaseProcedure — no auth required; return empty list when unauthenticated
  const auth = validateRequest(req);
  if (!auth.ok) return json({ connections: [] });

  const rows = listConnectionsForUser(auth.payload.userId);
  const connections = rows.map((r) => {
    const p = PROVIDERS[r.providerId];
    return {
      icon: p?.icon ?? '',
      providerId: r.providerId,
      providerName: p?.displayName ?? r.providerId,
      providerUsername: r.providerUsername,
      scopes: r.scopes,
      tokenExpiresAt: r.expiresAt ? new Date(r.expiresAt).toISOString() : null,
    };
  });
  return json({ connections });
};
