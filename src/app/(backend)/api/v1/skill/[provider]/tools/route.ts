import { json } from '@/server/services/marketStub/auth';
import { getProvider } from '@/server/services/marketStub/providers';

export const GET = async (_req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return json({ error: `Unknown provider: ${providerId}` }, 404);
  return json({ tools: provider.tools });
};
