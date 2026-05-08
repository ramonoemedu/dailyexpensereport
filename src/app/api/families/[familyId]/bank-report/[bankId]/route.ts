import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { rebuildBankReport } from '@/lib/dashboardReport';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string; bankId: string }> }
) {
  try {
    const { familyId, bankId } = await params;
    await verifyFamilyAccess(req, familyId);

    const prisma = getPrisma();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth());
    const forceRebuild = url.searchParams.get('rebuild') === 'true';

    const reportKey = `bank_${bankId}_${year}`;
    let reportRow = await prisma.familyReport.findUnique({
      where: { familyId_reportKey: { familyId, reportKey } },
    });

    let reportData = reportRow?.data as any;

    if (forceRebuild || !reportData?.months?.[month]) {
      await rebuildBankReport(familyId, bankId, year, month);
      reportRow = await prisma.familyReport.findUnique({
        where: { familyId_reportKey: { familyId, reportKey } },
      });
      reportData = reportRow?.data as any;
    }

    const monthData = reportData?.months?.[month] || { transactions: [], startingBalance: 0 };
    return NextResponse.json({
      transactions: monthData.transactions || [],
      startingBalance: monthData.startingBalance || 0,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load bank report.' }, { status: 500 });
  }
}
