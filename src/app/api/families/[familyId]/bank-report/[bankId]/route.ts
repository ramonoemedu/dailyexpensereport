import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { rebuildBankReport } from '@/lib/dashboardReport';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string; bankId: string }> }
) {
  try {
    const { familyId, bankId } = await params;
    await verifyFamilyAccess(req, familyId);

    const db = getAdminDb();
    const url = new URL(req.url);
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth());

    const reportSnap = await db
      .collection('families').doc(familyId)
      .collection('reports').doc(`bank_${bankId}_${year}`)
      .get();

    let reportData = reportSnap.exists ? (reportSnap.data() as any) : null;

    // Build on-demand if this month has no pre-computed data yet
    if (!reportData?.months?.[month]) {
      await rebuildBankReport(familyId, bankId, year, month);
      const fresh = await db
        .collection('families').doc(familyId)
        .collection('reports').doc(`bank_${bankId}_${year}`)
        .get();
      reportData = fresh.data() as any;
    }

    const monthData = reportData?.months?.[month] || { transactions: [], startingBalance: 0 };

    return NextResponse.json({
      transactions: monthData.transactions || [],
      startingBalance: monthData.startingBalance || 0,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load bank report.' },
      { status: 500 }
    );
  }
}
