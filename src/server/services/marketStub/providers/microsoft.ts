import type { ProviderDef } from './types';

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0';

async function graphFetch(path: string, accessToken: string, options: RequestInit = {}) {
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  if (!res.ok) throw new Error(`Microsoft Graph error ${res.status}: ${await res.text()}`);
  if (res.status === 204) return null;
  return res.json();
}

const microsoft: ProviderDef = {
  authorizeUrl: ({ callbackUrl, scopes, state }) => {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    if (!clientId) throw new Error('MICROSOFT_OAUTH_CLIENT_ID not set');
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: callbackUrl,
      response_type: 'code',
      scope: ['offline_access', ...scopes].join(' '),
      state,
    });
    return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params}`;
  },

  displayName: 'Outlook Calendar',
  icon: 'https://hub-apac-1.lobeobjects.space/assets/logos/outlook.svg',
  id: 'microsoft',

  async exchangeCode(code, callbackUrl) {
    const clientId = process.env.MICROSOFT_OAUTH_CLIENT_ID;
    const clientSecret = process.env.MICROSOFT_OAUTH_CLIENT_SECRET;
    if (!clientId || !clientSecret) throw new Error('MICROSOFT_OAUTH_CLIENT_ID/SECRET not set');

    const res = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
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
    if (!res.ok) throw new Error(`Microsoft token exchange failed: ${await res.text()}`);
    const data: any = await res.json();

    const me: any = await graphFetch('/me', data.access_token);
    return {
      accessToken: data.access_token,
      expiresIn: data.expires_in,
      providerUsername: me.userPrincipalName ?? me.displayName ?? 'Microsoft user',
      refreshToken: data.refresh_token,
    };
  },

  async executeTool(toolName, args, accessToken) {
    switch (toolName) {
      case 'list_events': {
        const data: any = await graphFetch(
          '/me/calendar/events?$top=10&$orderby=start/dateTime asc',
          accessToken,
        );
        return data.value?.map((e: any) => ({
          end: e.end?.dateTime,
          id: e.id,
          start: e.start?.dateTime,
          subject: e.subject,
        }));
      }
      case 'create_event': {
        const {
          subject,
          start,
          end,
          body: bodyContent,
        } = args as { body?: string; end: string; start: string; subject: string };
        const event = {
          body: bodyContent ? { content: bodyContent, contentType: 'text' } : undefined,
          end: { dateTime: end, timeZone: 'UTC' },
          start: { dateTime: start, timeZone: 'UTC' },
          subject,
        };
        return graphFetch('/me/calendar/events', accessToken, {
          body: JSON.stringify(event),
          method: 'POST',
        });
      }
      default: {
        throw new Error(`Unknown Microsoft tool: ${toolName}`);
      }
    }
  },

  scopes: ['Calendars.ReadWrite', 'User.Read'],

  tools: [
    {
      description: 'List upcoming calendar events from Outlook.',
      input_schema: { type: 'object' },
      name: 'list_events',
    },
    {
      description: 'Create a new event in the Outlook calendar.',
      input_schema: {
        properties: {
          body: { description: 'Event description', type: 'string' },
          end: { description: 'End time (ISO 8601 UTC)', type: 'string' },
          start: { description: 'Start time (ISO 8601 UTC)', type: 'string' },
          subject: { description: 'Event title/subject', type: 'string' },
        },
        required: ['subject', 'start', 'end'],
        type: 'object',
      },
      name: 'create_event',
    },
  ],
};

export default microsoft;
