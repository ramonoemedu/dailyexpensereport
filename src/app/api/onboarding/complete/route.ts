import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

type PendingMemberInput = {
  fullName?: string;
  username?: string;
  userId?: string;
  email?: string;
  password?: string;
};

function normalizeUsernameFromEmail(email: string | undefined, fallback: string) {
  const base = (email || '').split('@')[0] || fallback;
  return base.toLowerCase().replace(/[^a-z0-9._-]/g, '').slice(0, 24) || 'user';
}

export async function POST(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);
    const prisma = getPrisma();
    const body = await req.json();

    const familyName = String(body?.familyName || '').trim();
    const members = Array.isArray(body?.members) ? (body.members as PendingMemberInput[]) : [];

    if (!familyName) {
      return NextResponse.json({ error: 'Family name is required.' }, { status: 400 });
    }

    const owner = await prisma.user.findUnique({ where: { uid: payload.uid } });
    if (!owner) {
      return NextResponse.json({ error: 'User not found.' }, { status: 404 });
    }

    const existingFamilies = owner.families as Record<string, string>;
    if (Object.keys(existingFamilies).length > 0) {
      return NextResponse.json(
        { error: 'Onboarding already completed.', currentFamilyId: Object.keys(existingFamilies)[0] },
        { status: 409 }
      );
    }

    const familyId = randomUUID();
    const now = new Date();

    await prisma.family.create({
      data: {
        id: familyId,
        name: familyName,
        status: 'active',
        createdBy: payload.uid,
        createdAt: now,
        updatedAt: now,
        members: {
          create: {
            uid: payload.uid,
            role: 'admin',
            fullName: owner.fullName || 'Owner',
            email: owner.email,
            addedAt: now,
          },
        },
        settings: {
          create: {
            config: {
              balances: [],
              cashBalances: [],
              expenseTypes: ['Food', 'Transportation', 'Utilities', 'Other'],
              incomeTypes: [],
              incomeConfigs: [],
            } as any,
            updatedAt: now,
          },
        },
      },
    });

    const ownerFamilies = { ...existingFamilies, [familyId]: 'admin' };
    await prisma.user.update({
      where: { uid: payload.uid },
      data: { families: ownerFamilies, updatedAt: now },
    });

    const createdMembers: Array<{ uid: string; username: string; loginEmail: string; userId: string }> = [];
    const memberErrors: Array<{ username: string; error: string }> = [];

    for (const rawMember of members) {
      const fullName = String(rawMember?.fullName || '').trim();
      const username = String(rawMember?.username || '').trim().toLowerCase();
      const userId = String(rawMember?.userId || '').trim();
      const email = String(rawMember?.email || '').trim();
      const password = String(rawMember?.password || '');

      if (!fullName && !username && !userId && !email && !password) continue;

      if (!fullName || !username || !userId || !password) {
        memberErrors.push({ username: username || '(missing)', error: 'fullName, username, userId and password are required.' });
        continue;
      }

      try {
        const [dupeUsername, dupeUserId] = await Promise.all([
          prisma.user.findUnique({ where: { username } }),
          prisma.user.findUnique({ where: { userId } }),
        ]);

        if (dupeUsername) { memberErrors.push({ username, error: 'Username already exists.' }); continue; }
        if (dupeUserId) { memberErrors.push({ username, error: 'User ID already exists.' }); continue; }

        const loginEmail = email || `${username}@clearport.local`;
        const memberUid = randomUUID();
        const passwordHash = await hash(password, 12);

        await prisma.user.create({
          data: {
            uid: memberUid,
            fullName,
            username,
            userId,
            email,
            loginEmail,
            passwordHash,
            status: 'active',
            families: { [familyId]: 'member' },
          },
        });

        await prisma.familyMember.create({
          data: {
            familyId,
            uid: memberUid,
            role: 'member',
            fullName,
            email,
            addedAt: now,
          },
        });

        createdMembers.push({ uid: memberUid, username, loginEmail, userId });
      } catch (err: any) {
        memberErrors.push({ username: username || '(unknown)', error: err?.message || 'Failed to create member.' });
      }
    }

    return NextResponse.json({ success: true, familyId, familyName, createdMembers, memberErrors });
  } catch (error: any) {
    console.error('POST /api/onboarding/complete failed:', error);
    return NextResponse.json({ error: error?.message || 'Failed to complete onboarding.' }, { status: 500 });
  }
}
