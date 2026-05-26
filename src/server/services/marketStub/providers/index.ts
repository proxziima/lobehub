import github from './github';
import linear from './linear';
import microsoft from './microsoft';
import notion from './notion';
import twitter from './twitter';
import type { ProviderDef } from './types';
import vercel from './vercel';

export type { ProviderDef };
export { generateCodeVerifier } from './twitter';

export const PROVIDERS: Record<string, ProviderDef> = {
  github,
  linear,
  microsoft,
  notion,
  twitter,
  vercel,
};

export function getProvider(id: string): ProviderDef | undefined {
  return PROVIDERS[id];
}
