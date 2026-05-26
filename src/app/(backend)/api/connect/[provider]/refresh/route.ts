import { json, validateRequest } from '@/server/services/marketStub/auth';
import { getProvider } from '@/server/services/marketStub/providers';
import { getConnection } from '@/server/services/marketStub/store';

export const POST = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const conn = getConnection(auth.payload.userId, providerId);
  if (!conn) return json({ error: 'Not connected' }, 404);

  // For providers that support refresh tokens, you'd exchange here.
  // For now, signal that a re-auth is required if expired.
  const healthy = !conn.expiresAt || conn.expiresAt > Date.now();
  if (!healthy) {
    return json({ error: 'Token expired; please re-connect' }, 401);
  }

  const provider = getProvider(providerId);
  return json({
    connection: {
      providerUsername: conn.providerUsername,
      scopes: conn.scopes,
      tokenExpiresAt: conn.expiresAt ? new Date(conn.expiresAt).toISOString() : null,
    },
    icon: provider?.icon ?? '',
    providerName: provider?.displayName ?? providerId,
    refreshed: false,
  });
};
