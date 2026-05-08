import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

async function verifyAdmin(req: NextRequest) {
  const payload = extractTokenPayload(req);
  const prisma = getPrisma();
  const user = await prisma.user.findUnique({ where: { uid: payload.uid } });
  if (!user) throw new Error('Admin profile not found');

  const families = user.families as Record<string, string>;
  const isAdmin = user.systemAdmin || Object.values(families).includes('admin');
  if (!isAdmin) throw new Error('Admin access required');
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdmin(req);
    const { uid } = await params;
    if (!uid) return NextResponse.json({ error: 'User UID is required.' }, { status: 400 });

    const prisma = getPrisma();
    const user = await prisma.user.findUnique({ where: { uid } });
    if (!user) return NextResponse.json({ error: 'User not found.' }, { status: 404 });

    const families = user.families as Record<string, string>;
    const familyIds = Object.keys(families);

    await Promise.all(
      familyIds.map((fid) =>
        prisma.familyMember.deleteMany({ where: { familyId: fid, uid } }).catch(() => {})
      )
    );

    await prisma.user.delete({ where: { uid } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('DELETE /api/admin/users/[uid] failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to delete user.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdmin(req);
    const { uid } = await params;
    if (!uid) return NextResponse.json({ error: 'User UID is required.' }, { status: 400 });

    const body = await req.json();
    const fullName = String(body?.fullName || '').trim();
    const username = String(body?.username || '').trim().toLowerCase();
    const email = String(body?.email || '').trim();
    const userId = String(body?.userId || '').trim();
    const password = String(body?.password || '');
    const status = body?.status === 'inactive' ? 'inactive' : 'active';

    const prisma = getPrisma();

    if (username) {
      const dupe = await prisma.user.findFirst({
        where: { username, NOT: { uid } },
      });
      if (dupe) return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }

    const updateData: Record<string, unknown> = { status, updatedAt: new Date() };
    if (fullName) updateData.fullName = fullName;
    if (username) updateData.username = username;
    if (email) { updateData.email = email; updateData.loginEmail = email; }
    if (userId) updateData.userId = userId;
    if (password) updateData.passwordHash = await hash(password, 12);

    await prisma.user.update({ where: { uid }, data: updateData });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('PATCH /api/admin/users/[uid] failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to update user.' }, { status: 500 });
  }
}
