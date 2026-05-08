import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  return authHeader.slice(7);
}

function getRequestedFamilyId(req: NextRequest) {
  return req.headers.get('x-family-id') || new URL(req.url).searchParams.get('familyId');
}

async function verifyAdmin(req: NextRequest) {
  const payload = extractTokenPayload(req);
  const prisma = getPrisma();

  const user = await prisma.user.findUnique({ where: { uid: payload.uid } });
  if (!user) throw new Error('Admin profile not found');

  const families = user.families as Record<string, string>;
  const adminFamilyIds = Object.entries(families)
    .filter(([, role]) => role === 'admin')
    .map(([fid]) => fid);

  if (!user.systemAdmin && adminFamilyIds.length === 0) throw new Error('Admin access required');

  const requestedFamilyId = getRequestedFamilyId(req);
  if (requestedFamilyId && !user.systemAdmin && !adminFamilyIds.includes(requestedFamilyId)) {
    throw new Error('Admin access required for selected family');
  }

  const primaryFamilyId = requestedFamilyId || adminFamilyIds[0] || null;
  return { uid: user.uid, primaryFamilyId, isSystemAdmin: user.systemAdmin };
}

export async function GET(req: NextRequest) {
  try {
    const { primaryFamilyId } = await verifyAdmin(req);
    if (!primaryFamilyId) return NextResponse.json({ users: [] });

    const prisma = getPrisma();
    const members = await prisma.familyMember.findMany({ where: { familyId: primaryFamilyId } });
    const memberUids = [...new Set(members.map((m) => m.uid))];

    if (memberUids.length === 0) return NextResponse.json({ users: [] });

    const users = await prisma.user.findMany({
      where: { uid: { in: memberUids } },
      select: { uid: true, fullName: true, username: true, userId: true, loginEmail: true, email: true, status: true },
    });

    const result = users.map((u) => ({
      id: u.uid,
      uid: u.uid,
      fullName: u.fullName || u.username,
      username: u.username,
      loginEmail: u.loginEmail || u.email,
      userId: u.userId,
      status: u.status as 'active' | 'inactive',
      email: u.email || u.loginEmail,
    })).sort((a, b) => a.username.localeCompare(b.username));

    return NextResponse.json({ users: result });
  } catch (error: any) {
    const message = error?.message || 'Unauthorized';
    const status = message.includes('Admin') || message.includes('token') ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { primaryFamilyId } = await verifyAdmin(req);
    const body = await req.json();

    const fullName = String(body?.fullName || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const userId = String(body?.userId || '').trim();
    const password = String(body?.password || '');
    const status = body?.status === 'inactive' ? 'inactive' : 'active';
    const email = String(body?.email || '').trim();
    const loginEmail = String(body?.loginEmail || '').trim() || email || `${username}@clearport.local`;

    if (!fullName || !username || !password || !userId) {
      return NextResponse.json({ error: 'Missing required fields.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const [dupeUsername, dupeUserId] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { userId } }),
    ]);

    if (dupeUsername) return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    if (dupeUserId) return NextResponse.json({ error: 'User ID already exists.' }, { status: 409 });

    const uid = randomUUID();
    const passwordHash = await hash(password, 12);
    const families = primaryFamilyId ? { [primaryFamilyId]: 'member' } : {};
    const now = new Date();

    await prisma.user.create({
      data: {
        uid, fullName, username, userId, email, loginEmail, passwordHash,
        status, families, createdAt: now, updatedAt: now,
      },
    });

    if (primaryFamilyId) {
      await prisma.familyMember.upsert({
        where: { familyId_uid: { familyId: primaryFamilyId, uid } },
        create: { familyId: primaryFamilyId, uid, role: 'member', fullName, email, addedAt: now },
        update: { role: 'member', fullName, email },
      });
    }

    return NextResponse.json({ uid }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/admin/users failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to create user.' }, { status: 500 });
  }
}
