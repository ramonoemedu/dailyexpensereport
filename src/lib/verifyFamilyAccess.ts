import { NextRequest } from 'next/server';
import { verifyToken, JwtPayload } from '@/lib/jwt';
import { getPrisma } from '@/lib/prisma';

function getBearerToken(req: NextRequest): string | null {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

type CachedAccess = { uid: string; role: string; expiry: number };
const accessCache = new Map<string, CachedAccess>();
const ACCESS_CACHE_TTL_MS = 30_000;

/**
 * Verifies that the request's bearer token belongs to a user who has access
 * to the given family. Result is cached for 30s.
 */
export async function verifyFamilyAccess(
  req: NextRequest,
  familyId: string,
  adminOnly = false
): Promise<{ uid: string; role: string }> {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');

  const cacheKey = `${token}:${familyId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (adminOnly && cached.role !== 'admin') throw new Error('Family admin access required');
    return { uid: cached.uid, role: cached.role };
  }

  const payload = verifyToken(token);
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { uid: payload.uid } });
  if (!user) throw new Error('User not found');
  if (user.status !== 'active') throw new Error('Account disabled');

  const families = user.families as Record<string, string>;
  let role = families[familyId];

  if (!role && user.systemAdmin) {
    role = 'admin';
  }

  if (!role) throw new Error('Family access denied');
  if (adminOnly && role !== 'admin') throw new Error('Family admin access required');

  accessCache.set(cacheKey, { uid: user.uid, role, expiry: Date.now() + ACCESS_CACHE_TTL_MS });
  return { uid: user.uid, role };
}

export function extractTokenPayload(req: NextRequest): JwtPayload {
  const token = getBearerToken(req);
  if (!token) throw new Error('Missing bearer token');
  return verifyToken(token);
}
