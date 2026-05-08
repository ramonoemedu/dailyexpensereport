import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

type BalanceItem = { bankId: string; year: number; month: number; amount: number };

async function readConfig(familyId: string) {
  const prisma = getPrisma();
  const settings = await prisma.familySettings.findUnique({ where: { familyId } });
  const config = (settings?.config as Record<string, unknown>) || {};
  const balances = Array.isArray(config.balances)
    ? (config.balances as any[])
        .map((b) => ({
          bankId: String(b.bankId || '').trim(),
          year: Number(b.year),
          month: Number(b.month),
          amount: Number(b.amount || 0),
        }))
        .filter((b) => b.bankId && Number.isFinite(b.year) && Number.isFinite(b.month))
    : [];
  return { config, balances };
}

async function saveConfig(familyId: string, config: Record<string, unknown>) {
  const prisma = getPrisma();
  await prisma.familySettings.upsert({
    where: { familyId },
    create: { familyId, config, updatedAt: new Date() },
    update: { config, updatedAt: new Date() },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);
    const { balances } = await readConfig(familyId);
    const items = balances
      .map((b) => ({ id: `${b.bankId}_${b.year}_${b.month}`, ...b }))
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    return NextResponse.json({ balances: items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 403 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, true);

    const body = await req.json();
    const bankId = String(body?.bankId || '').trim();
    const year = Number(body?.year);
    const month = Number(body?.month);
    const amount = Number(body?.amount);

    if (!bankId || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount)) {
      return NextResponse.json({ error: 'Invalid balance payload.' }, { status: 400 });
    }

    const { config, balances } = await readConfig(familyId);
    const idx = balances.findIndex((b) => b.bankId === bankId && b.year === year && b.month === month);
    if (idx >= 0) balances[idx] = { bankId, year, month, amount };
    else balances.push({ bankId, year, month, amount });

    await saveConfig(familyId, { ...config, balances, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save balance.' }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, true);

    const { searchParams } = new URL(req.url);
    const bankId = String(searchParams.get('bankId') || '').trim();
    const year = Number(searchParams.get('year'));
    const month = Number(searchParams.get('month'));

    if (!bankId || !Number.isFinite(year) || !Number.isFinite(month)) {
      return NextResponse.json({ error: 'Missing bankId/year/month query params.' }, { status: 400 });
    }

    const { config, balances } = await readConfig(familyId);
    const filtered = balances.filter((b) => !(b.bankId === bankId && b.year === year && b.month === month));
    await saveConfig(familyId, { ...config, balances: filtered, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete balance.' }, { status: 500 });
  }
}
