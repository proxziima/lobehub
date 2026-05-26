import { json, validateRequest } from '@/server/services/marketStub/auth';
import { deleteConnection } from '@/server/services/marketStub/store';

export const DELETE = async (
  req: Request,
  { params }: { params: Promise<{ provider: string }> },
) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  deleteConnection(auth.payload.userId, providerId);
  return json({ revoked: true });
};
