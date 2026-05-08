import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

type IncomeConfig = { id: string; name: string; amount: number; dayOfMonth: number; status: 'active' | 'inactive' };

async function readConfig(familyId: string) {
  const settings = await getPrisma().familySettings.findUnique({ where: { familyId } });
  const config = (settings?.config as Record<string, unknown>) || {};
  const items = (Array.isArray(config.incomeConfigs) ? config.incomeConfigs : [])
    .map((x: any) => ({
      id: String(x.id || '').trim(),
      name: String(x.name || '').trim(),
      amount: Number(x.amount || 0),
      dayOfMonth: Number(x.dayOfMonth || 1),
      status: x.status === 'inactive' ? 'inactive' : 'active',
    } as IncomeConfig))
    .filter((i) => i.id && i.name);
  return { config, items };
}

async function saveConfig(familyId: string, config: Record<string, unknown>, items: IncomeConfig[]) {
  await getPrisma().familySettings.upsert({
    where: { familyId },
    create: { familyId, config: { ...config, incomeConfigs: items, updatedAt: new Date().toISOString() }, updatedAt: new Date() },
    update: { config: { ...config, incomeConfigs: items, updatedAt: new Date().toISOString() }, updatedAt: new Date() },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);
    const { items } = await readConfig(familyId);
    return NextResponse.json({ configs: items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 403 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const body = await req.json();
    const name = String(body?.name || '').trim();
    const amount = Number(body?.amount);
    const dayOfMonth = Number(body?.dayOfMonth);
    const status = body?.status === 'inactive' ? 'inactive' : 'active';

    if (!name || !Number.isFinite(amount) || !Number.isFinite(dayOfMonth)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const { config, items } = await readConfig(familyId);
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: 'Income source already exists.' }, { status: 409 });
    }

    const nextItem: IncomeConfig = { id: randomUUID(), name, amount, dayOfMonth, status };
    await saveConfig(familyId, config, [...items, nextItem]);
    return NextResponse.json({ config: nextItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create income source.' }, { status: 500 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const body = await req.json();
    const id = String(body?.id || '').trim();
    const name = String(body?.name || '').trim();
    const amount = Number(body?.amount);
    const dayOfMonth = Number(body?.dayOfMonth);
    const status = body?.status === 'inactive' ? 'inactive' : 'active';

    if (!id || !name || !Number.isFinite(amount) || !Number.isFinite(dayOfMonth)) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const { config, items } = await readConfig(familyId);
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) return NextResponse.json({ error: 'Income source not found.' }, { status: 404 });

    items[idx] = { id, name, amount, dayOfMonth, status };
    await saveConfig(familyId, config, items);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update income source.' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const id = String(new URL(req.url).searchParams.get('id') || '').trim();
    if (!id) return NextResponse.json({ error: 'Missing id query param.' }, { status: 400 });

    const { config, items } = await readConfig(familyId);
    await saveConfig(familyId, config, items.filter((i) => i.id !== id));
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete income source.' }, { status: 500 });
  }
}
