import { NextRequest, NextResponse } from 'next/server';
import { getAdminAuth, getAdminDb } from '@/lib/firebaseAdmin';
import { rebuildMonthReport } from '@/lib/dashboardReport';

/**
 * POST /api/admin/seed-dashboard-reports
 *
 * One-time seeder: scans all families' existing expenses, finds every unique
 * year/month combination that has data, and builds the pre-computed report doc
 * for each one.
 *
 * Requires a valid system-admin bearer token.
 */
export async function POST(req: NextRequest) {
  try {
    // Verify system admin
    const authHeader = req.headers.get('authorization') || '';
    if (!authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing bearer token' }, { status: 401 });
    }
    const token = authHeader.slice(7);
    const decoded = await getAdminAuth().verifyIdToken(token);

    const db = getAdminDb();
    const userDoc = await db.collection('system_users').doc(decoded.uid).get();
    const userData = userDoc.exists ? (userDoc.data() as any) : null;
    if (!userData?.isSystemAdmin) {
      return NextResponse.json({ error: 'System admin access required' }, { status: 403 });
    }

    // Get all families
    const familiesSnap = await db.collection('families').get();
    const results: Record<string, any> = {};

    for (const familyDoc of familiesSnap.docs) {
      const familyId = familyDoc.id;
      results[familyId] = { rebuilt: [], errors: [] };

      // Get all expenses for this family to find which year/months have data
      const expensesSnap = await db
        .collection('families').doc(familyId)
        .collection('expenses')
        .select('Date') // only fetch Date field — lightweight
        .get();

      // Collect unique year/month combos
      const monthKeys = new Set<string>();
      expensesSnap.docs.forEach(d => {
        const dateStr = String(d.data().Date || '');
        if (!dateStr) return;
        const parsed = new Date(dateStr);
        if (!isNaN(parsed.getTime())) {
          monthKeys.add(`${parsed.getFullYear()}:${parsed.getMonth()}`);
        }
      });

      // Rebuild each unique month
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

    const totalRebuilt = Object.values(results).reduce(
      (sum: number, r: any) => sum + r.rebuilt.length, 0
    );

    return NextResponse.json({
      success: true,
      families: familiesSnap.size,
      totalMonthsRebuilt: totalRebuilt,
      details: results,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Seed failed.' },
      { status: 500 }
    );
  }
}
