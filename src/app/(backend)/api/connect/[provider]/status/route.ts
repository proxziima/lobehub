import { json, validateRequest } from '@/server/services/marketStub/auth';
import { getProvider } from '@/server/services/marketStub/providers';
import { getConnection } from '@/server/services/marketStub/store';

export const GET = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  const conn = getConnection(auth.payload.userId, providerId);

  if (!conn) {
    return json({
      connected: false,
      icon: provider?.icon ?? '',
      providerName: provider?.displayName ?? providerId,
    });
  }

  return json({
    connected: true,
    connection: {
      providerUsername: conn.providerUsername,
      scopes: conn.scopes,
      tokenExpiresAt: conn.expiresAt ? new Date(conn.expiresAt).toISOString() : null,
    },
    icon: provider?.icon ?? '',
    providerName: provider?.displayName ?? providerId,
  });
};
