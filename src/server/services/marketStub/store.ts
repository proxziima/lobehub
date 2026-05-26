/**
 * In-memory store for the local Market stub.
 * All state is lost on Next.js restart — acceptable for dev.
 * Upgrade path: swap these Maps for SQLite/Drizzle calls behind the same interface.
 */

export interface ConnectionRow {
  accessToken: string;
  expiresAt: number | null;
  providerId: string;
  providerUsername: string;
  refreshToken?: string;
  scopes: string[];
  userId: string;
}

export interface OAuthStateRow {
  codeVerifier?: string;
  createdAt: number;
  provider: string;
  redirectUri: string;
  userId: string;
}

// key: `${userId}:${providerId}`
export const connections = new Map<string, ConnectionRow>();

// key: state nonce (random hex) — 10-min TTL enforced on read
export const oauthStates = new Map<string, OAuthStateRow>();

const STATE_TTL_MS = 10 * 60 * 1000;

export function getConnection(userId: string, providerId: string): ConnectionRow | undefined {
  return connections.get(`${userId}:${providerId}`);
}

export function setConnection(row: ConnectionRow): void {
  connections.set(`${row.userId}:${row.providerId}`, row);
}

export function deleteConnection(userId: string, providerId: string): void {
  connections.delete(`${userId}:${providerId}`);
}

export function listConnectionsForUser(userId: string): ConnectionRow[] {
  return [...connections.values()].filter((c) => c.userId === userId);
}

export function setOAuthState(state: string, row: OAuthStateRow): void {
  oauthStates.set(state, row);
}

export function popOAuthState(state: string): OAuthStateRow | undefined {
  const row = oauthStates.get(state);
  if (!row) return undefined;
  oauthStates.delete(state);
  if (Date.now() - row.createdAt > STATE_TTL_MS) return undefined;
  return row;
}
