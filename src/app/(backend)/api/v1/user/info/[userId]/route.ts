/**
 * Stub for GET /api/v1/user/info/:userId — called by market.user.getUserByUsername tRPC procedure.
 * Looks up the local user record and returns an OIDC-style user object.
 * Returns 404 when the user isn't found so the tRPC layer surfaces NOT_FOUND.
 */
import { UserModel } from '@/database/models/user';
import { serverDB } from '@/database/server';
import { json } from '@/server/services/marketStub/auth';

export const GET = async (_req: Request, { params }: { params: Promise<{ userId: string }> }) => {
  const { userId } = await params;

  try {
    const user = await UserModel.findById(serverDB, userId);

    if (!user) {
      // Also try by username in case the caller passed a display username
      const byUsername = await UserModel.findByUsername(serverDB, userId);
      if (!byUsername) {
        return json({ error: 'User not found' }, 404);
      }
      return json({
        user: {
          avatarUrl: byUsername.avatar || null,
          createdAt: new Date().toISOString(),
          displayName: byUsername.fullName || byUsername.username || byUsername.id,
          id: byUsername.id,
          meta: {},
          namespace: byUsername.username || byUsername.id,
          type: 'user',
          userName: byUsername.username || byUsername.id,
        },
      });
    }

    return json({
      user: {
        avatarUrl: user.avatar || null,
        createdAt: new Date().toISOString(),
        displayName: user.fullName || user.username || user.id,
        id: user.id,
        meta: {},
        namespace: user.username || user.id,
        type: 'user',
        userName: user.username || user.id,
      },
    });
  } catch {
    return json({ error: 'User not found' }, 404);
  }
};
