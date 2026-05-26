/**
 * Stub for GET /api/v1/skills — serves the snapshot captured in public/sample-data/skills/list.json.
 * The snapshot is the tRPC envelope form; we unwrap [0].result.data.json before serving.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { json } from '@/server/services/marketStub/auth';

const EMPTY = { currentPage: 1, items: [], pageSize: 20, totalCount: 0, totalPages: 0 };
const FILE = path.join(process.cwd(), 'public/sample-data/skills/list.json');

export const GET = async (req: Request) => {
  const { searchParams } = new URL(req.url);
  const page = Number(searchParams.get('page')) || 1;

  try {
    const raw = await readFile(FILE, 'utf8');
    const parsed = JSON.parse(raw);

    // Unwrap tRPC envelope if present
    const data = Array.isArray(parsed) ? (parsed[0]?.result?.data?.json ?? parsed) : parsed;

    return json({ ...data, currentPage: page });
  } catch {
    return json({ ...EMPTY, currentPage: page });
  }
};
