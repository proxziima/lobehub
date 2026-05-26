import type { ProviderDef } from './types';

async function vercelFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.vercel.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Vercel API error ${res.status}: ${await res.text()}`);
  return res.json();
}

const vercel: ProviderDef = {
  authorizeUrl: ({ callbackUrl, state }) => {
    const clientId = process.env.VERCEL_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('VERCEL_OAUTH_CLIENT_ID not set');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      state,
    });
    return `https://vercel.com/integrations/${clientId}/new?${params}`;
  },

  displayName: 'Vercel',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/vercel.svg',
  id: 'vercel',

  async exchangeCode(code, callbackUrl) {
    const clientId = process.env.VERCEL_OAUTH_CLIENT_ID;
    const clientSecret = process.env.VERCEL_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('VERCEL_OAUTH_CLIENT_ID/SECRET not set');

    const res = await fetch('https://api.vercel.com/v2/oauth/access_token', {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Vercel token exchange failed: ${await res.text()}`);
    const data: any = await res.json();

    const me: any = await vercelFetch('/v2/user', data.access_token);
    return { accessToken: data.access_token, providerUsername: me.user?.username ?? 'Vercel user' };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'list_projects': {
        const data: any = await vercelFetch('/v9/projects?limit=20', accessToken);
        return data.projects?.map((p: any) => ({
          id: p.id,
          name: p.name,
          url: `https://vercel.com/${p.name}`,
        }));
      }
      case 'list_deployments': {
        const { project_id } = args as { project_id: string };
        const data: any = await vercelFetch(
          `/v6/deployments?projectId=${project_id}&limit=10`,
          accessToken,
        );
        return data.deployments?.map((d: any) => ({ id: d.uid, state: d.state, url: d.url }));
      }
      default: {
        throw new Error(`Unknown Vercel tool: ${toolName}`);
      }
    }
  },

  scopes: [],

  tools: [
    {
      description: 'List all Vercel projects for the authenticated user/team.',
      input_schema: { type: 'object' },
      name: 'list_projects',
    },
    {
      description: 'List recent deployments for a Vercel project.',
      input_schema: {
        properties: { project_id: { description: 'Vercel project ID', type: 'string' } },
        required: ['project_id'],
        type: 'object',
      },
      name: 'list_deployments',
    },
  ],
};

export default vercel;
