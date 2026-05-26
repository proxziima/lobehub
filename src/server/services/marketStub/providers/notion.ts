import type { ProviderDef } from './types';

const NOTION_VERSION = '2022-06-28';

async function notionFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`https://api.notion.com${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      'Notion-Version': NOTION_VERSION,
      ...options.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Notion API error ${res.status}: ${body}`);
  }
  return res.json();
}

const notion: ProviderDef = {
  authorizeUrl: ({ callbackUrl, scopes, state }) => {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('NOTION_OAUTH_CLIENT_ID not set');
    const params = new URLSearchParams({
      client_id: clientId,
      owner: 'user',
      redirect_uri: callbackUrl,
      response_type: 'code',
      state,
    });
    return `https://api.notion.com/v1/oauth/authorize?${params}`;
  },

  displayName: 'Notion',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/notion.svg',
  id: 'notion',

  async exchangeCode(code, callbackUrl) {
    const clientId = process.env.NOTION_OAUTH_CLIENT_ID;
    const clientSecret = process.env.NOTION_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('NOTION_OAUTH_CLIENT_ID/SECRET not set');

    const res = await fetch('https://api.notion.com/v1/oauth/token', {
      body: JSON.stringify({ code, grant_type: 'authorization_code', redirect_uri: callbackUrl }),
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/json',
        'Notion-Version': NOTION_VERSION,
      },
      method: 'POST',
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Notion token exchange failed: ${body}`);
    }
    const data: any = await res.json();
    return {
      accessToken: data.access_token,
      providerUsername: data.owner?.user?.name ?? data.workspace_name ?? 'Notion user',
    };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'search': {
        const query = (args.query as string) ?? '';
        const data = await notionFetch('/v1/search', accessToken, {
          body: JSON.stringify({ query, page_size: 10 }),
          method: 'POST',
        });
        return data.results?.map((r: any) => ({
          id: r.id,
          title:
            r.properties?.title?.title?.[0]?.plain_text ??
            r.properties?.Name?.title?.[0]?.plain_text ??
            '(untitled)',
          type: r.object,
          url: r.url,
        }));
      }
      case 'query_database': {
        const databaseId = args.database_id as string;
        if (!databaseId) throw new Error('database_id is required');
        const data = await notionFetch(`/v1/databases/${databaseId}/query`, accessToken, {
          body: JSON.stringify({ page_size: args.page_size ?? 10 }),
          method: 'POST',
        });
        return data.results;
      }
      case 'create_page': {
        const { parent_id, title, content } = args as {
          parent_id: string;
          title: string;
          content?: string;
        };
        const body: any = {
          parent: { database_id: parent_id },
          properties: {
            title: { title: [{ text: { content: title }, type: 'text' }] },
          },
        };
        if (content) {
          body.children = [
            {
              object: 'block',
              paragraph: { rich_text: [{ text: { content }, type: 'text' }] },
              type: 'paragraph',
            },
          ];
        }
        return notionFetch('/v1/pages', accessToken, {
          body: JSON.stringify(body),
          method: 'POST',
        });
      }
      case 'update_page': {
        const { page_id, properties } = args as {
          page_id: string;
          properties: Record<string, unknown>;
        };
        return notionFetch(`/v1/pages/${page_id}`, accessToken, {
          body: JSON.stringify({ properties }),
          method: 'PATCH',
        });
      }
      default: {
        throw new Error(`Unknown Notion tool: ${toolName}`);
      }
    }
  },

  scopes: [],

  tools: [
    {
      description: "Search pages, databases, and blocks in the user's Notion workspace.",
      input_schema: {
        properties: {
          query: { description: 'Search query text', type: 'string' },
        },
        type: 'object',
      },
      name: 'search',
    },
    {
      description: 'Query a Notion database and return its rows.',
      input_schema: {
        properties: {
          database_id: { description: 'Notion database ID', type: 'string' },
          page_size: { description: 'Max results (default 10)', type: 'number' },
        },
        required: ['database_id'],
        type: 'object',
      },
      name: 'query_database',
    },
    {
      description: 'Create a new page inside a Notion database.',
      input_schema: {
        properties: {
          content: { description: 'Optional body text', type: 'string' },
          parent_id: { description: 'Database ID to create the page in', type: 'string' },
          title: { description: 'Page title', type: 'string' },
        },
        required: ['parent_id', 'title'],
        type: 'object',
      },
      name: 'create_page',
    },
    {
      description: 'Update properties of an existing Notion page.',
      input_schema: {
        properties: {
          page_id: { description: 'Notion page ID', type: 'string' },
          properties: {
            description: 'Properties to update (Notion property object)',
            type: 'object',
          },
        },
        required: ['page_id', 'properties'],
        type: 'object',
      },
      name: 'update_page',
    },
  ],
};

export default notion;
