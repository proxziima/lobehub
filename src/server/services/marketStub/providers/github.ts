import type { ProviderDef } from './types';

async function ghFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...options,
    headers: {
      'Accept': 'application/vnd.github+json',
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'X-GitHub-Api-Version': '2022-11-28',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
  return res.json();
}

const github: ProviderDef = {
  authorizeUrl: ({ callbackUrl, scopes, state }) => {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('GITHUB_OAUTH_CLIENT_ID not set');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      scope: scopes.join(' '),
      state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
  },

  displayName: 'GitHub',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/github.svg',
  id: 'github',

  async exchangeCode(code, callbackUrl) {
    const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
    const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('GITHUB_OAUTH_CLIENT_ID/SECRET not set');

    const res = await fetch('https://github.com/login/oauth/access_token', {
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: callbackUrl,
      }),
      headers: { 'Accept': 'application/json', 'Content-Type': 'application/json' },
      method: 'POST',
    });
    const data: any = await res.json();
    if (data.error)
      throw new Error(`GitHub token exchange: ${data.error_description ?? data.error}`);

    const user: any = await ghFetch('/user', data.access_token);
    return { accessToken: data.access_token, providerUsername: user.login };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'list_repos': {
        return ghFetch('/user/repos?sort=updated&per_page=20', accessToken);
      }
      case 'get_repo': {
        const { owner, repo } = args as { owner: string; repo: string };
        return ghFetch(`/repos/${owner}/${repo}`, accessToken);
      }
      case 'list_issues': {
        const {
          owner,
          repo,
          state: issueState = 'open',
        } = args as { owner: string; repo: string; state?: string };
        return ghFetch(
          `/repos/${owner}/${repo}/issues?state=${issueState}&per_page=20`,
          accessToken,
        );
      }
      case 'create_issue': {
        const { owner, repo, title, body } = args as {
          body?: string;
          owner: string;
          repo: string;
          title: string;
        };
        return ghFetch(`/repos/${owner}/${repo}/issues`, accessToken, {
          body: JSON.stringify({ body, title }),
          method: 'POST',
        });
      }
      default: {
        throw new Error(`Unknown GitHub tool: ${toolName}`);
      }
    }
  },

  scopes: ['repo', 'read:user'],

  tools: [
    {
      description: "List the authenticated user's repositories.",
      input_schema: { type: 'object' },
      name: 'list_repos',
    },
    {
      description: 'Get details of a specific repository.',
      input_schema: {
        properties: {
          owner: { description: 'Repository owner (user or org)', type: 'string' },
          repo: { description: 'Repository name', type: 'string' },
        },
        required: ['owner', 'repo'],
        type: 'object',
      },
      name: 'get_repo',
    },
    {
      description: 'List issues for a repository.',
      input_schema: {
        properties: {
          owner: { description: 'Repository owner', type: 'string' },
          repo: { description: 'Repository name', type: 'string' },
          state: { description: 'open, closed, or all (default: open)', type: 'string' },
        },
        required: ['owner', 'repo'],
        type: 'object',
      },
      name: 'list_issues',
    },
    {
      description: 'Create a new issue in a repository.',
      input_schema: {
        properties: {
          body: { description: 'Issue body/description', type: 'string' },
          owner: { description: 'Repository owner', type: 'string' },
          repo: { description: 'Repository name', type: 'string' },
          title: { description: 'Issue title', type: 'string' },
        },
        required: ['owner', 'repo', 'title'],
        type: 'object',
      },
      name: 'create_issue',
    },
  ],
};

export default github;
