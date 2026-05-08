import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

async function getConfig(familyId: string) {
  const settings = await getPrisma().familySettings.findUnique({ where: { familyId } });
  return (settings?.config as Record<string, unknown>) || {};
}

async function saveConfig(familyId: string, config: Record<string, unknown>) {
  await getPrisma().familySettings.upsert({
    where: { familyId },
    create: { familyId, config, updatedAt: new Date() },
    update: { config, updatedAt: new Date() },
  });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const config = await getConfig(familyId);
    const incomeConfigs = Array.isArray(config.incomeConfigs) ? config.incomeConfigs : [];
    const storedIncomeTypes = Array.isArray(config.incomeTypes) ? config.incomeTypes : [];
    const incomeTypes = storedIncomeTypes.length > 0
      ? storedIncomeTypes
      : incomeConfigs.map((c: any) => String(c.name || '').trim()).filter(Boolean);

    return NextResponse.json({
      expenseTypes: Array.isArray(config.expenseTypes) ? config.expenseTypes : [],
      incomeTypes,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Unauthorized' }, { status: 403 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ familyId: string }> }) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const body = await req.json();
    const kind = String(body?.kind || '').trim();
    const types = Array.isArray(body?.types)
      ? body.types.map((t: unknown) => String(t).trim()).filter(Boolean)
      : null;

    if (!types || (kind !== 'expense' && kind !== 'income')) {
      return NextResponse.json({ error: 'Invalid payload.' }, { status: 400 });
    }

    const config = await getConfig(familyId);
    const fieldName = kind === 'expense' ? 'expenseTypes' : 'incomeTypes';
    await saveConfig(familyId, { ...config, [fieldName]: types, updatedAt: new Date().toISOString() });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to save types.' }, { status: 500 });
  }
}
