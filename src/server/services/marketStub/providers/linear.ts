import type { ProviderDef } from './types';

async function linearFetch(query: string, variables: Record<string, unknown>, accessToken: string) {
  const res = await fetch('https://api.linear.app/graphql', {
    body: JSON.stringify({ query, variables }),
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    method: 'POST',
  });
  if (!res.ok) throw new Error(`Linear API error ${res.status}: ${await res.text()}`);
  const { data, errors } = (await res.json()) as any;
  if (errors?.length) throw new Error(`Linear GraphQL error: ${errors[0].message}`);
  return data;
}

const linear: ProviderDef = {
  authorizeUrl: ({ callbackUrl, scopes, state }) => {
    const clientId = process.env.LINEAR_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('LINEAR_OAUTH_CLIENT_ID not set');
    const params = new URLSearchParams({
      actor: 'user',
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: scopes.join(','),
      state,
    });
    return `https://linear.app/oauth/authorize?${params}`;
  },

  displayName: 'Linear',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/linear.svg',
  id: 'linear',

  async exchangeCode(code, callbackUrl) {
    const clientId = process.env.LINEAR_OAUTH_CLIENT_ID;
    const clientSecret = process.env.LINEAR_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('LINEAR_OAUTH_CLIENT_ID/SECRET not set');

    const res = await fetch('https://api.linear.app/oauth/token', {
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: callbackUrl,
      }),
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      method: 'POST',
    });
    if (!res.ok) throw new Error(`Linear token exchange failed: ${await res.text()}`);
    const data: any = await res.json();

    const me = await linearFetch('query { viewer { name } }', {}, data.access_token);
    return { accessToken: data.access_token, providerUsername: me.viewer?.name ?? 'Linear user' };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'list_issues': {
        const data = await linearFetch(
          `query($first: Int) { issues(first: $first, orderBy: updatedAt) { nodes { id title state { name } assignee { name } url } } }`,
          { first: (args.limit as number) ?? 20 },
          accessToken,
        );
        return data.issues?.nodes;
      }
      case 'create_issue': {
        const { title, description, team_id } = args as {
          description?: string;
          team_id: string;
          title: string;
        };
        const data = await linearFetch(
          `mutation($title: String!, $description: String, $teamId: String!) { issueCreate(input: { title: $title, description: $description, teamId: $teamId }) { success issue { id title url } } }`,
          { description, teamId: team_id, title },
          accessToken,
        );
        return data.issueCreate?.issue;
      }
      case 'list_teams': {
        const data = await linearFetch('query { teams { nodes { id name } } }', {}, accessToken);
        return data.teams?.nodes;
      }
      default: {
        throw new Error(`Unknown Linear tool: ${toolName}`);
      }
    }
  },

  scopes: ['read', 'write'],

  tools: [
    {
      description: 'List issues assigned to the user or all issues in the workspace.',
      input_schema: {
        properties: { limit: { description: 'Max results (default 20)', type: 'number' } },
        type: 'object',
      },
      name: 'list_issues',
    },
    {
      description: 'Create a new issue in a Linear team.',
      input_schema: {
        properties: {
          description: { description: 'Issue description (markdown)', type: 'string' },
          team_id: { description: 'Linear team ID', type: 'string' },
          title: { description: 'Issue title', type: 'string' },
        },
        required: ['title', 'team_id'],
        type: 'object',
      },
      name: 'create_issue',
    },
    {
      description: 'List available teams in the workspace.',
      input_schema: { type: 'object' },
      name: 'list_teams',
    },
  ],
};

export default linear;
