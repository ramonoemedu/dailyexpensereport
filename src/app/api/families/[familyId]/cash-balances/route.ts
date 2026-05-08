import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

type CashBalance = { year: number; month: number; amount: number; amountKHR: number };

async function readConfig(familyId: string) {
  const settings = await getPrisma().familySettings.findUnique({ where: { familyId } });
  const config = (settings?.config as Record<string, unknown>) || {};
  const cashBalances = Array.isArray(config.cashBalances)
    ? (config.cashBalances as any[]).map((b) => ({
        year: Number(b.year),
        month: Number(b.month),
        amount: Number(b.amount || 0),
        amountKHR: Number(b.amountKHR || 0),
      })).filter((b) => Number.isFinite(b.year) && Number.isFinite(b.month))
    : [];
  return { config, cashBalances };
}

async function saveConfig(familyId: string, config: Record<string, unknown>) {
  await getPrisma().familySettings.upsert({
    where: { familyId },
    create: { familyId, config: config as any, updatedAt: new Date() },
    update: { config: config as any, updatedAt: new Date() },
  });
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);
    const { cashBalances } = await readConfig(familyId);
    const balances = cashBalances
      .map((b) => ({ id: `cash_balance_${b.year}_${b.month}`, ...b }))
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));
    return NextResponse.json({ balances });
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
    const year = Number(body?.year);
    const month = Number(body?.month);
    const amount = Number(body?.amount || 0);
    const amountKHR = Number(body?.amountKHR || 0);

    if (!Number.isFinite(year) || !Number.isFinite(month)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const { config, cashBalances } = await readConfig(familyId);
    const idx = cashBalances.findIndex((b) => b.year === year && b.month === month);
    const item = { year, month, amount, amountKHR };
    if (idx >= 0) cashBalances[idx] = item;
    else cashBalances.push(item);

    await saveConfig(familyId, { ...config, cashBalances, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save cash balance.' }, { status: 500 });
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
    const id = String(searchParams.get('id') || '');
    const parts = id.replace('cash_balance_', '').split('_');
    const year = Number(parts[0]);
    const month = Number(parts[1]);

    if (!id.startsWith('cash_balance_') || !Number.isFinite(year) || !Number.isFinite(month)) {
      return NextResponse.json({ error: 'Invalid id.' }, { status: 400 });
    }

    const { config, cashBalances } = await readConfig(familyId);
    const filtered = cashBalances.filter((b) => !(b.year === year && b.month === month));
    await saveConfig(familyId, { ...config, cashBalances: filtered, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete cash balance.' }, { status: 500 });
  }
}
