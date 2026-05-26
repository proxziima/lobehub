/**
 * Stub for GET /api/v1/skills/:identifier — returns 404; no individual skill data captured.
 * The tRPC layer converts this to NOT_FOUND which the UI handles gracefully.
 */
import { json } from '@/server/services/marketStub/auth';

export const GET = () => json({ error: 'Skill not found in local stub' }, 404);
