import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getAdminDb } from '@/lib/firebaseAdmin';
import { autoCategorize } from '@/utils/DescriptionHelper';
import { rebuildMonthReport, rebuildBankReport } from '@/lib/dashboardReport';
import { BANKS } from '@/utils/bankConstants';

export const runtime = 'nodejs';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const { transactions, bankId = 'chip-mong' } = await req.json() as {
      transactions: Array<{
        date: string;
        description: string;
        amount: number;
        type: 'Income' | 'Expense';
        currency: string;
        refNo?: string;
      }>;
      bankId?: string;
    };

    if (!transactions?.length) {
      return NextResponse.json({ error: 'No transactions to import' }, { status: 400 });
    }

    const db = getAdminDb();
    const now = new Date().toISOString();
    const paymentMethod = bankId === 'chip-mong' ? 'Chip Mong Bank' : bankId;
    const affectedMonths = new Set<string>();

    // Firestore batch limit is 500 — chunk if needed
    const chunks: typeof transactions[] = [];
    for (let i = 0; i < transactions.length; i += 400) {
      chunks.push(transactions.slice(i, i + 400));
    }

    let totalImported = 0;
    for (const chunk of chunks) {
      const batch = db.batch();
      for (const tx of chunk) {
        const ref = db
          .collection('families').doc(familyId)
          .collection('expenses').doc();

        batch.set(ref, {
          Date: tx.date,
          Description: tx.description,
          Amount: tx.amount,
          Type: tx.type,
          Currency: tx.currency,
          'Payment Method': paymentMethod,
          Category: autoCategorize(tx.description, ''),
          status: 'active',
          createdAt: now,
          importRef: tx.refNo || '',
        });

        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) {
          affectedMonths.add(`${d.getFullYear()}:${d.getMonth()}`);
        }
        totalImported++;
      }
      await batch.commit();
    }

    // Rebuild reports for all affected months (non-blocking)
    for (const key of affectedMonths) {
      const [year, month] = key.split(':').map(Number);
      rebuildMonthReport(familyId, year, month).catch(() => {});
      BANKS.forEach(b => rebuildBankReport(familyId, b.id, year, month).catch(() => {}));
    }

    return NextResponse.json({ imported: totalImported });
  } catch (err: any) {
    console.error('[import/confirm]', err);
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 });
  }
}
