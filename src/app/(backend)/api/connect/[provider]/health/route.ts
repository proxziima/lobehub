import { json, validateRequest } from '@/server/services/marketStub/auth';
import { getConnection } from '@/server/services/marketStub/store';

export const GET = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const conn = getConnection(auth.payload.userId, providerId);
  if (!conn) return json({ healthy: false, tokenStatus: 'not_connected' });

  const healthy = !conn.expiresAt || conn.expiresAt > Date.now();
  return json({ healthy, tokenStatus: healthy ? 'valid' : 'expired' });
};
