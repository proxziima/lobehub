import { json, validateRequest } from '@/server/services/marketStub/auth';
import { getProvider } from '@/server/services/marketStub/providers';
import { getConnection } from '@/server/services/marketStub/store';

export const POST = async (req: Request, { params }: { params: Promise<{ provider: string }> }) => {
  const auth = validateRequest(req);
  if (!auth.ok) return auth.response;

  const { provider: providerId } = await params;
  const provider = getProvider(providerId);
  if (!provider) return json({ error: `Unknown provider: ${providerId}` }, 404);

  const conn = getConnection(auth.payload.userId, providerId);
  if (!conn) {
    return json(
      { error: 'NOT_CONNECTED', message: `Not connected to ${providerId}. Please connect first.` },
      401,
    );
  }

  if (conn.expiresAt && conn.expiresAt < Date.now()) {
    return json(
      { error: 'TOKEN_EXPIRED', message: `${providerId} token expired. Please re-connect.` },
      401,
    );
  }

  let body: { args?: Record<string, unknown>; tool: string; topicId?: string };
  try {
    body = await req.json();
  } catch {
    return json({ error: 'Invalid JSON body' }, 400);
  }

  try {
    const result = await provider.executeTool(body.tool, body.args ?? {}, conn.accessToken);
    return json({ content: result, success: true });
  } catch (err: any) {
    return json({ error: err.message, success: false }, 500);
  }
};
