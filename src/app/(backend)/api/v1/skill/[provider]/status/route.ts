import { json, validateRequest } from '@/server/services/marketStub/auth';
import { getProvider } from '@/server/services/marketStub/providers';
import { getConnection } from '@/server/services/marketStub/store';

export const GET = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  const conn = getConnection(auth.payload.userId, providerId);

  return json({
    connected: !!conn,
    icon: provider?.icon ?? '',
    providerName: provider?.displayName ?? providerId,
  });
};
