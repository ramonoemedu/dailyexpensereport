import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);
    const prisma = getPrisma();
    const { familyId } = await req.json();

    if (!familyId) {
      return NextResponse.json({ error: 'familyId is required' }, { status: 400 });
    }

    const [user, family] = await Promise.all([
      prisma.user.findUnique({ where: { uid: payload.uid } }),
      prisma.family.findUnique({ where: { id: familyId }, select: { id: true, name: true } }),
    ]);

    if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    if (!family) return NextResponse.json({ error: 'Family not found' }, { status: 404 });

    const families = user.families as Record<string, string>;
    let userRole = families[familyId];

    if (!userRole && user.systemAdmin) {
      userRole = 'admin';
    }

    if (!userRole) {
      // Check family_members table
      const member = await prisma.familyMember.findUnique({
        where: { familyId_uid: { familyId, uid: user.uid } },
      });
      if (member) userRole = member.role;
    }

    if (!userRole) {
      return NextResponse.json({ error: 'User does not have access to this family' }, { status: 403 });
    }

    return NextResponse.json({
      success: true,
      familyId,
      familyName: family.name,
      userRole,
      profile: {
        uid: user.uid,
        fullName: user.fullName,
        username: user.username,
        families,
      },
    });
  } catch (error) {
    console.error('/api/users/me/switch-family POST failed:', error);
    return NextResponse.json({ error: 'Family switch failed' }, { status: 500 });
  }
}
