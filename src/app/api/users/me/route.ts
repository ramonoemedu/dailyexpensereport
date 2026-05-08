import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { uid: payload.uid } });
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    let families = user.families as Record<string, string>;

    // System admins get access to all families
    if (user.systemAdmin) {
      const allFamilies = await prisma.family.findMany({ select: { id: true } });
      for (const f of allFamilies) {
        if (!families[f.id]) families[f.id] = 'admin';
      }
    }

    const familyIds = Object.keys(families);
    const currentFamilyId = familyIds[0] || null;

    const familyNames: Record<string, string> = {};
    if (familyIds.length > 0) {
      const familyDocs = await prisma.family.findMany({
        where: { id: { in: familyIds } },
        select: { id: true, name: true },
      });
      familyDocs.forEach((f) => { familyNames[f.id] = f.name; });
    }

    const profile = {
      uid: user.uid,
      fullName: user.fullName,
      username: user.username,
      userId: user.userId,
      email: user.email,
      loginEmail: user.loginEmail,
      status: user.status,
      systemAdmin: user.systemAdmin,
      families,
      currentFamilyId: user.currentFamilyId || currentFamilyId,
    };

    return NextResponse.json({
      uid: user.uid,
      profile,
      currentFamilyId: user.currentFamilyId || currentFamilyId,
      userRole: currentFamilyId ? families[currentFamilyId] : null,
      familyNames,
    });
  } catch (error) {
    console.error('/api/users/me GET failed:', error);
    return NextResponse.json({ error: 'User context resolution failed' }, { status: 500 });
  }
}
