/**
 * Stub for GET /api/v1/skills/categories — serves public/sample-data/skills/categories.json if present.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { json } from '@/server/services/marketStub/auth';

const FILE = path.join(process.cwd(), 'public/sample-data/skills/categories.json');

export const GET = async () => {
  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);
    const data = Array.isArray(parsed) ? (parsed[0]?.result?.data?.json ?? parsed) : parsed;
    return json(data);
  } catch {
    return json({ categories: [] });
  }
};
