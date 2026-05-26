import { json } from '@/server/services/marketStub/auth';
import { PROVIDERS } from '@/server/services/marketStub/providers';

export const GET = () => {
  const providers = Object.values(PROVIDERS).map((p) => ({
    displayName: p.displayName,
    icon: p.icon,
    id: p.id,
    tools: p.tools.map((t) => t.name),
  }));
  return json({ providers });
};
