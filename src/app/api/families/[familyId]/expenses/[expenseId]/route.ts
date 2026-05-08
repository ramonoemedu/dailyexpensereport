import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { rebuildMonthReport, rebuildBankReport } from '@/lib/dashboardReport';
import { BANKS } from '@/utils/bankConstants';

function mapToUiRow(e: any) {
  return {
    id: e.id,
    Date: e.date,
    Amount: e.amount,
    'Amount (Income/Expense)': e.amount,
    Currency: e.currency,
    Type: e.type,
    Description: e.description,
    Category: e.category,
    'Payment Method': e.paymentMethod,
    status: e.status,
    createdAt: e.createdAt,
    ...(e.extraData as object || {}),
  };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string; expenseId: string }> }
) {
  try {
    const { familyId, expenseId } = await params;
    await verifyFamilyAccess(req, familyId);
    const expense = await getPrisma().expense.findUnique({ where: { id: expenseId } });
    if (!expense || expense.familyId !== familyId) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }
    return NextResponse.json({ expense: mapToUiRow(expense) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch expense.' }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string; expenseId: string }> }
) {
  try {
    const { familyId, expenseId } = await params;
    await verifyFamilyAccess(req, familyId);

    if (!expenseId) {
      return NextResponse.json({ error: 'Missing expense id.' }, { status: 400 });
    }

    const body = await req.json();
    const data = (body?.data || {}) as Record<string, unknown>;
    const prisma = getPrisma();

    const old = await prisma.expense.findUnique({ where: { id: expenseId } });

    await prisma.expense.update({
      where: { id: expenseId },
      data: {
        ...(data.Date !== undefined && { date: String(data.Date) }),
        ...(data.Amount !== undefined && { amount: Number(data.Amount) }),
        ...(data.Currency !== undefined && { currency: String(data.Currency) }),
        ...(data.Type !== undefined && { type: String(data.Type) }),
        ...(data.Description !== undefined && { description: String(data.Description) }),
        ...(data.Category !== undefined && { category: String(data.Category) }),
        ...(data['Payment Method'] !== undefined && { paymentMethod: String(data['Payment Method']) }),
        ...(data.status !== undefined && { status: String(data.status) }),
        updatedAt: new Date(),
      },
    });

    const monthKeys = new Set<string>();
    const addMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) monthKeys.add(`${d.getFullYear()}:${d.getMonth()}`);
    };
    const newDate = String(data.Date || '');
    const oldDate = old?.date || '';
    if (newDate) addMonth(newDate);
    if (oldDate && oldDate !== newDate) addMonth(oldDate);

    for (const key of monthKeys) {
      const [y, m] = key.split(':').map(Number);
      rebuildMonthReport(familyId, y, m).catch(() => {});
      BANKS.forEach((b) => rebuildBankReport(familyId, b.id, y, m).catch(() => {}));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to update expense.' }, { status: 500 });
  }
}
