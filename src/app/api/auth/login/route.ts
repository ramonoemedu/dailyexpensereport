import { NextRequest, NextResponse } from 'next/server';
import { compare } from 'bcryptjs';
import { signToken } from '@/lib/jwt';
import { getPrisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const identifier = String(body?.identifier || body?.email || '').trim();
    const password = String(body?.password || '');

    if (!identifier || !password) {
      return NextResponse.json({ error: 'Identifier and password are required.' }, { status: 400 });
    }

    const prisma = getPrisma();
    const isEmail = identifier.includes('@');

    let user = null;
    if (isEmail) {
      user = await prisma.user.findFirst({
        where: { OR: [{ loginEmail: identifier }, { email: identifier }] },
      });
    } else {
      user = await prisma.user.findFirst({
        where: {
          OR: [
            { username: identifier.toLowerCase() },
            { userId: identifier.toUpperCase() },
            { userId: identifier },
          ],
        },
      });
    }

    if (!user) {
      return NextResponse.json({ error: 'Username or User ID not found.' }, { status: 404 });
    }

    if (user.status !== 'active') {
      return NextResponse.json({ error: 'This account is currently inactive.' }, { status: 403 });
    }

    if (!user.passwordHash) {
      return NextResponse.json({ error: 'Password not configured. Contact your administrator.' }, { status: 403 });
    }

    const valid = await compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: 'Incorrect identifier or password.' }, { status: 401 });
    }

    const token = signToken({ uid: user.uid, email: user.loginEmail || user.email });
    return NextResponse.json({ token, uid: user.uid, loginEmail: user.loginEmail || user.email });
  } catch (error: any) {
    console.error('POST /api/auth/login failed:', error);
    return NextResponse.json({ error: error?.message || 'Login failed.' }, { status: 500 });
  }
}
