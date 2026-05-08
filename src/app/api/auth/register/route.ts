import { NextRequest, NextResponse } from 'next/server';
import { hash } from 'bcryptjs';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

function normalizeUsername(raw: string) {
  return raw.toLowerCase().trim().replace(/[^a-z0-9._-]/g, '');
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const fullName = String(body?.fullName || '').trim();
    const username = normalizeUsername(String(body?.username || ''));
    const userId = String(body?.userId || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const password = String(body?.password || '');

    if (!fullName || !username || !userId || !email || !password) {
      return NextResponse.json(
        { error: 'fullName, username, userId, email and password are required.' },
        { status: 400 }
      );
    }

    if (password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters.' }, { status: 400 });
    }

    const prisma = getPrisma();

    const [existingUsername, existingUserId, existingEmail] = await Promise.all([
      prisma.user.findUnique({ where: { username } }),
      prisma.user.findUnique({ where: { userId } }),
      prisma.user.findFirst({ where: { OR: [{ email }, { loginEmail: email }] } }),
    ]);

    if (existingUsername) {
      return NextResponse.json({ error: 'Username already exists.' }, { status: 409 });
    }
    if (existingUserId) {
      return NextResponse.json({ error: 'User ID already exists.' }, { status: 409 });
    }
    if (existingEmail) {
      return NextResponse.json({ error: 'Email already exists.' }, { status: 409 });
    }

    const uid = randomUUID();
    const passwordHash = await hash(password, 12);
    const now = new Date();

    await prisma.user.create({
      data: {
        uid,
        fullName,
        username,
        userId,
        email,
        loginEmail: email,
        passwordHash,
        status: 'active',
        families: {},
        createdAt: now,
        updatedAt: now,
      },
    });

    return NextResponse.json({ success: true, uid, loginEmail: email }, { status: 201 });
  } catch (error: any) {
    console.error('POST /api/auth/register failed:', error);
    return NextResponse.json({ error: error?.message || 'Registration failed.' }, { status: 500 });
  }
}
