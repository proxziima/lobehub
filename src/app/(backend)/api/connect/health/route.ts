import { json, validateRequest } from '@/server/services/marketStub/auth';
import { listConnectionsForUser } from '@/server/services/marketStub/store';

export const GET = (req: Request) => {
  // lobehubSkillBaseProcedure — return empty health when unauthenticated
  const auth = validateRequest(req);
  if (!auth.ok) return json({ connections: [], summary: { connected: 0, healthy: 0 } });

  const rows = listConnectionsForUser(auth.payload.userId);
  const now = Date.now();
  const connections = rows.map((r) => ({
    healthy: !r.expiresAt || r.expiresAt > now,
    providerId: r.providerId,
    tokenStatus: !r.expiresAt ? 'valid' : r.expiresAt > now ? 'valid' : 'expired',
  }));
  return json({
    connections,
    summary: {
      connected: connections.length,
      healthy: connections.filter((c) => c.healthy).length,
    },
  });
};
