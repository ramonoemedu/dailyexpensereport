import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { rebuildMonthReport } from '@/lib/dashboardReport';

export async function POST(req: NextRequest) {
  try {
    const payload = extractTokenPayload(req);
    const prisma = getPrisma();

    const user = await prisma.user.findUnique({ where: { uid: payload.uid } });
    if (!user?.systemAdmin) {
      return NextResponse.json({ error: 'System admin access required' }, { status: 403 });
    }

    const families = await prisma.family.findMany({ select: { id: true } });
    const results: Record<string, any> = {};

    for (const family of families) {
      const familyId = family.id;
      results[familyId] = { rebuilt: [], errors: [] };

      const expenses = await prisma.expense.findMany({
        where: { familyId },
        select: { date: true },
      });

      const monthKeys = new Set<string>();
      expenses.forEach((e) => {
        if (!e.date) return;
        const parsed = new Date(e.date);
        if (!isNaN(parsed.getTime())) {
          monthKeys.add(`${parsed.getFullYear()}:${parsed.getMonth()}`);
        }
      });

      for (const key of monthKeys) {
        const [year, month] = key.split(':').map(Number);
        try {
          await rebuildMonthReport(familyId, year, month);
          results[familyId].rebuilt.push(`${year}-${String(month + 1).padStart(2, '0')}`);
        } catch (err: any) {
          results[familyId].errors.push({ month: key, error: err?.message });
        }
      }
    }

    const totalRebuilt = Object.values(results).reduce((sum: number, r: any) => sum + r.rebuilt.length, 0);
    return NextResponse.json({ success: true, families: families.length, totalMonthsRebuilt: totalRebuilt, details: results });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Seed failed.' }, { status: 500 });
  }
}
