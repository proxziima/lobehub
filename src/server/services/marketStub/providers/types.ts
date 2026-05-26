export interface ToolInputSchema {
  description?: string;
  properties?: Record<string, { description?: string; type: string }>;
  required?: string[];
  type: 'object';
}

export interface ToolDef {
  description: string;
  input_schema: ToolInputSchema;
  name: string;
}

export interface ProviderDef {
  authorizeUrl: (params: {
    callbackUrl: string;
    scopes: string[];
    state: string;
    codeVerifier?: string;
  }) => string;
  displayName: string;
  /** Exchange code for tokens; returns { accessToken, refreshToken?, expiresIn?, providerUsername } */
  exchangeCode: (
    code: string,
    callbackUrl: string,
    codeVerifier?: string,
  ) => Promise<{
    accessToken: string;
    expiresIn?: number;
    providerUsername: string;
    refreshToken?: string;
  }>;
  /** Execute a tool call against the provider's API */
  executeTool: (
    toolName: string,
    args: Record<string, unknown>,
    accessToken: string,
  ) => Promise<unknown>;
  icon: string;
  id: string;
  scopes: string[];
  tools: ToolDef[];
}
