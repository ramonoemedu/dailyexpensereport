import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

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

  return { uid: user.uid, adminFamilyIds, isSystemAdmin: user.systemAdmin };
}

export async function GET(req: NextRequest) {
  try {
    const { adminFamilyIds, isSystemAdmin } = await verifyAdmin(req);
    const prisma = getPrisma();

    const families = await prisma.family.findMany({
      include: { members: true },
    });

    const userUids = [...new Set(families.flatMap((f) => f.members.map((m) => m.uid)))];
    const users = await prisma.user.findMany({
      where: { uid: { in: userUids } },
      select: { uid: true, fullName: true, username: true, loginEmail: true, email: true },
    });
    const userMap = new Map(users.map((u) => [u.uid, u]));

    const results = families.map((fam) => {
      const members = fam.members.map((m) => {
        const u = userMap.get(m.uid);
        return {
          uid: m.uid,
          role: m.role,
          fullName: u?.fullName || m.fullName || '',
          username: u?.username || '',
          loginEmail: u?.loginEmail || u?.email || '',
        };
      });

      return {
        id: fam.id,
        name: fam.name,
        status: fam.status,
        memberCount: fam.members.length,
        members,
        createdAt: fam.createdAt,
        manageable: isSystemAdmin || adminFamilyIds.includes(fam.id),
      };
    });

    results.sort((a, b) => String(a.name).localeCompare(String(b.name)));
    return NextResponse.json({ families: results });
  } catch (error: any) {
    const msg = error?.message || 'Unauthorized';
    const status = msg.includes('Admin') || msg.includes('token') ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { adminFamilyIds, isSystemAdmin } = await verifyAdmin(req);
    const body = await req.json();
    const familyId = String(body?.familyId || '').trim();
    const status = body?.status === 'inactive' ? 'inactive' : 'active';

    if (!familyId) {
      return NextResponse.json({ error: 'familyId is required.' }, { status: 400 });
    }

    if (!isSystemAdmin && !adminFamilyIds.includes(familyId)) {
      return NextResponse.json({ error: 'Admin access required for this family.' }, { status: 403 });
    }

    await getPrisma().family.update({ where: { id: familyId }, data: { status, updatedAt: new Date() } });
    return NextResponse.json({ success: true, familyId, status });
  } catch (error: any) {
    console.error('PATCH /api/admin/families failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update family.' }, { status: 500 });
  }
}
