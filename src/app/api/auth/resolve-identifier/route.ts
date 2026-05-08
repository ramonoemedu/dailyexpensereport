import { NextRequest, NextResponse } from 'next/server';
import { getPrisma } from '@/lib/prisma';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const identifier = String(body?.identifier || '').trim();

    if (!identifier) {
      return NextResponse.json({ error: 'Identifier is required.' }, { status: 400 });
    }

    if (identifier.includes('@')) {
      return NextResponse.json({ loginEmail: identifier });
    }

    const prisma = getPrisma();
    const normalized = identifier.toLowerCase();
    const normalizedUpper = identifier.toUpperCase();

    const user = await prisma.user.findFirst({
      where: {
        OR: [
          { username: normalized },
          { userId: normalizedUpper },
          { userId: identifier },
        ],
      },
      select: { loginEmail: true, email: true, status: true, username: true },
    });

    if (!user) {
      return NextResponse.json({ error: 'Username or User ID not found.' }, { status: 404 });
    }

    if (user.status === 'inactive') {
      return NextResponse.json({ error: 'This account is currently inactive.' }, { status: 403 });
    }

    const loginEmail = user.loginEmail || user.email || `${user.username}@clearport.local`;
    return NextResponse.json({ loginEmail });
  } catch (error) {
    console.error('resolve-identifier failed', error);
    return NextResponse.json({ error: 'Login system error. Please try again later.' }, { status: 500 });
  }
}
