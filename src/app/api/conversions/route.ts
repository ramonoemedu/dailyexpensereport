import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

export async function POST(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);
    const body = await req.json();
    const record = (body?.record || {}) as Record<string, unknown>;

    const conversion = await getPrisma().pdfConversion.create({
      data: {
        id: randomUUID(),
        userId: payload.uid,
        data: { ...record, userId: payload.uid },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return NextResponse.json({ id: conversion.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save conversion.' }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);

    const records = await getPrisma().pdfConversion.findMany({
      where: { userId: payload.uid },
      orderBy: { createdAt: 'desc' },
    });

    return NextResponse.json({
      records: records.map((r) => ({ id: r.id, ...(r.data as object), createdAt: r.createdAt })),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load conversions.' }, { status: 500 });
  }
}
