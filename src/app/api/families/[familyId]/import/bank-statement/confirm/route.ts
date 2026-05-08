import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { autoCategorize } from '@/utils/DescriptionHelper';
import { rebuildMonthReport, rebuildBankReport } from '@/lib/dashboardReport';
import { BANKS } from '@/utils/bankConstants';
import { randomUUID } from 'crypto';

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

    const prisma = getPrisma();
    const now = new Date();
    const paymentMethod = bankId === 'chip-mong' ? 'Chip Mong Bank' : bankId;
    const affectedMonths = new Set<string>();

    await prisma.expense.createMany({
      data: transactions.map((tx) => {
        const d = new Date(tx.date);
        if (!isNaN(d.getTime())) affectedMonths.add(`${d.getFullYear()}:${d.getMonth()}`);
        return {
          id: randomUUID(),
          familyId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          type: tx.type,
          currency: tx.currency,
          paymentMethod,
          category: autoCategorize(tx.description, ''),
          status: 'active',
          importRef: tx.refNo || '',
          extraData: {},
          createdAt: now,
          updatedAt: now,
        };
      }),
    });

    for (const key of affectedMonths) {
      const [year, month] = key.split(':').map(Number);
      rebuildMonthReport(familyId, year, month).catch(() => {});
      BANKS.forEach((b) => rebuildBankReport(familyId, b.id, year, month).catch(() => {}));
    }

    return NextResponse.json({ imported: transactions.length });
  } catch (err: any) {
    console.error('[import/confirm]', err);
    return NextResponse.json({ error: err?.message || 'Import failed' }, { status: 500 });
  }
}
