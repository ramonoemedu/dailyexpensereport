import { NextRequest, NextResponse } from 'next/server';
import dayjs from 'dayjs';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { randomUUID } from 'crypto';

type IncomeConfig = { id: string; name: string; amount: number; dayOfMonth: number; status: 'active' | 'inactive' };

async function readIncomeConfigs(familyId: string): Promise<IncomeConfig[]> {
  const settings = await getPrisma().familySettings.findUnique({ where: { familyId } });
  const config = (settings?.config as Record<string, unknown>) || {};
  return (Array.isArray(config.incomeConfigs) ? config.incomeConfigs : [])
    .map((x: any) => ({
      id: String(x.id || '').trim(),
      name: String(x.name || '').trim(),
      amount: Number(x.amount || 0),
      dayOfMonth: Number(x.dayOfMonth || 1),
      status: x.status === 'inactive' ? 'inactive' : 'active',
    } as IncomeConfig))
    .filter((i) => i.id && i.name);
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, true);

    const body = await req.json();
    const processType = body?.processType === 'yearly' ? 'yearly' : 'monthly';
    const processDate = dayjs(String(body?.processDate || ''));

    if (!processDate.isValid()) {
      return NextResponse.json({ error: 'Invalid process date.' }, { status: 400 });
    }

    const configs = (await readIncomeConfigs(familyId)).filter((c) => c.status === 'active');
    if (configs.length === 0) return NextResponse.json({ createdCount: 0, skippedCount: 0 });

    const prisma = getPrisma();
    const monthsToProcess = processType === 'yearly'
      ? Array.from({ length: 12 }, (_, i) => i)
      : [processDate.month()];

    let createdCount = 0, skippedCount = 0;

    for (const monthIdx of monthsToProcess) {
      const target = processDate.month(monthIdx);
      for (const config of configs) {
        const dateStr = target.date(config.dayOfMonth).format('YYYY-MM-DD');
        const dup = await prisma.expense.findFirst({
          where: { familyId, date: dateStr, category: config.name, type: 'Income' },
        });
        if (dup) { skippedCount++; continue; }

        await prisma.expense.create({
          data: {
            id: randomUUID(),
            familyId,
            date: dateStr,
            type: 'Income',
            category: config.name,
            description: `Auto-Generated: ${config.name}`,
            amount: config.amount,
            paymentMethod: 'Cash',
            currency: 'USD',
            status: 'active',
            importRef: '',
            extraData: {},
          },
        });
        createdCount++;
      }
    }

    return NextResponse.json({ createdCount, skippedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to process incomes.' }, { status: 500 });
  }
}
