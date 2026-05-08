import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { rebuildMonthReport, rebuildBankReport } from '@/lib/dashboardReport';
import { BANKS } from '@/utils/bankConstants';
import { randomUUID } from 'crypto';

function toInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function expandPaymentFilters(filters: string[]) {
  return filters.flatMap((f) => {
    const lower = f.toLowerCase();
    if (lower.includes('chip mong')) return [lower, 'from chipmong bank to acaleda', 'chip mong bank'];
    if (lower.includes('acleda')) return [lower, 'acleda bank', 'from chipmong bank to acaleda'];
    return [lower];
  });
}

function mapExpenseToUiRow(e: any) {
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
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const prisma = getPrisma();
    const url = new URL(req.url);
    const page = Math.max(1, toInt(url.searchParams.get('page'), 1));
    const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get('pageSize'), 20)));
    const month = toInt(url.searchParams.get('month'), new Date().getMonth());
    const year = toInt(url.searchParams.get('year'), new Date().getFullYear());
    const date = url.searchParams.get('date') || null;
    const searchText = (url.searchParams.get('searchText') || '').toLowerCase().trim();
    const typeFilter = url.searchParams.get('typeFilter') || 'All';
    const statusFilter = (url.searchParams.get('statusFilter') || 'active') as 'active' | 'inactive' | 'all';
    const paymentMethodsRaw = (url.searchParams.get('paymentMethods') || '').trim();
    const paymentMethods = paymentMethodsRaw ? paymentMethodsRaw.split('|').map((x) => x.trim()).filter(Boolean) : [];
    const expandedPaymentFilters = expandPaymentFilters(paymentMethods);
    const balanceType = (url.searchParams.get('balanceType') || 'bank') as 'bank' | 'cash';
    const bankId = url.searchParams.get('bankId') || '';

    // When all=true, return all expenses without month/page limits (used for client-side stats)
    const all = url.searchParams.get('all') === 'true';
    if (all) {
      const allExpenses = await prisma.expense.findMany({
        where: { familyId },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      });
      return NextResponse.json({ rows: allExpenses.map(mapExpenseToUiRow), totalRows: allExpenses.length });
    }

    const mm = String(month + 1).padStart(2, '0');
    const monthStart = date || `${year}-${mm}-01`;
    const monthEndDate = new Date(year, month + 1, 0);
    const monthEnd = date || `${year}-${mm}-${String(monthEndDate.getDate()).padStart(2, '0')}`;

    const [allExpenses, settings] = await Promise.all([
      prisma.expense.findMany({
        where: { familyId, date: { gte: monthStart, lte: monthEnd } },
        orderBy: [{ date: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.familySettings.findUnique({ where: { familyId } }),
    ]);

    const filtered = allExpenses.filter((e) => {
      if (statusFilter !== 'all') {
        if (statusFilter === 'active' && e.status !== 'active') return false;
        if (statusFilter === 'inactive' && e.status !== 'inactive') return false;
      }
      if (typeFilter !== 'All' && e.type !== typeFilter) return false;
      const method = e.paymentMethod.toLowerCase().trim();
      if (expandedPaymentFilters.length > 0) {
        const pass = expandedPaymentFilters.some((f) => method.includes(f) || f.includes(method));
        if (!pass) return false;
      }
      if (searchText) {
        const haystack = [e.description, e.paymentMethod, e.category].join(' ').toLowerCase();
        if (!haystack.includes(searchText)) return false;
      }
      return true;
    });

    const totalRows = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize).map(mapExpenseToUiRow);

    const uniqueDescriptions = [...new Set(filtered.map((e) => e.description).filter(Boolean))].sort();

    const filteredStats = { totalDebit: 0, totalCredit: 0, totalDebitKHR: 0, totalCreditKHR: 0 };
    let monthlyIncome = 0, monthlyExpense = 0;

    filtered.forEach((e) => {
      const amount = Math.abs(e.amount);
      const isIncome = e.type === 'Income';
      if (e.currency === 'KHR') {
        if (isIncome) filteredStats.totalDebitKHR += amount;
        else filteredStats.totalCreditKHR += amount;
      } else {
        if (isIncome) { filteredStats.totalDebit += amount; monthlyIncome += amount; }
        else { filteredStats.totalCredit += amount; monthlyExpense += amount; }
      }
    });

    const config = (settings?.config as any) || {};
    const familyBankBalances = Array.isArray(config?.balances) ? config.balances : [];
    const familyCashBalances = Array.isArray(config?.cashBalances) ? config.cashBalances : [];
    const targetTime = year * 12 + month;

    const selectedBalances = balanceType === 'cash'
      ? familyCashBalances
      : bankId ? familyBankBalances.filter((b: any) => b.bankId === bankId) : familyBankBalances;

    const normalizedBalances = selectedBalances
      .map((b: any) => ({ year: Number(b.year), month: Number(b.month), amount: Number(b.amount || 0), amountKHR: Number(b.amountKHR || 0) }))
      .filter((b: any) => Number.isFinite(b.year) && Number.isFinite(b.month))
      .sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    const anchor = [...normalizedBalances].reverse().find((r: any) => (r.year * 12 + r.month) <= targetTime);
    let startingBalance = anchor ? Number(anchor.amount || 0) : 0;
    let startingBalanceKHR = anchor ? Number(anchor.amountKHR || 0) : 0;

    if (anchor && (anchor.year * 12 + anchor.month) < targetTime) {
      const anchorMonthStart = `${anchor.year}-${String(anchor.month + 1).padStart(2, '0')}-01`;
      const prevMonthDate = new Date(year, month, 0);
      const prevMonthEnd = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;

      const carryExpenses = await prisma.expense.findMany({
        where: { familyId, date: { gte: anchorMonthStart, lte: prevMonthEnd } },
      });

      carryExpenses.forEach((e) => {
        const status = e.status;
        if (statusFilter !== 'all') {
          if (statusFilter === 'active' && status !== 'active') return;
          if (statusFilter === 'inactive' && status !== 'inactive') return;
        }
        const method = e.paymentMethod.toLowerCase().trim();
        if (expandedPaymentFilters.length > 0) {
          const pass = expandedPaymentFilters.some((f) => method.includes(f) || f.includes(method));
          if (!pass) return;
        }
        const amount = Math.abs(e.amount);
        const isIncome = e.type === 'Income';
        if (e.currency === 'KHR') {
          if (isIncome) startingBalanceKHR += amount; else startingBalanceKHR -= amount;
        } else {
          if (isIncome) startingBalance += amount; else startingBalance -= amount;
        }
      });
    }

    const stats = {
      weeklyIncome: 0, weeklyExpense: 0,
      monthlyIncome, monthlyExpense,
      totalIncome: monthlyIncome, totalExpense: monthlyExpense,
      startingBalance,
      currentBalance: startingBalance + monthlyIncome - monthlyExpense,
      startingBalanceKHR,
      monthlyIncomeKHR: filteredStats.totalDebitKHR,
      monthlyExpenseKHR: filteredStats.totalCreditKHR,
      currentBalanceKHR: startingBalanceKHR + filteredStats.totalDebitKHR - filteredStats.totalCreditKHR,
    };

    return NextResponse.json({ rows: pageRows, totalRows, page, pageSize, stats, filteredStats, uniqueDescriptions });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to fetch expenses.' }, { status: 500 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const body = await req.json();
    const data = (body?.data || {}) as Record<string, unknown>;

    const prisma = getPrisma();
    const expense = await prisma.expense.create({
      data: {
        id: randomUUID(),
        familyId,
        date: String(data.Date || data.date || ''),
        amount: Number(data.Amount || data.amount || 0),
        currency: String(data.Currency || data.currency || 'USD'),
        type: String(data.Type || data.type || 'Expense'),
        description: String(data.Description || data.description || ''),
        category: String(data.Category || data.category || ''),
        paymentMethod: String(data['Payment Method'] || data['Payment_Method'] || data.paymentMethod || ''),
        status: String(data.status || 'active'),
        importRef: String(data.importRef || ''),
        extraData: {},
        createdAt: data.createdAt ? new Date(String(data.createdAt)) : new Date(),
        updatedAt: new Date(),
      },
    });

    const dateStr = String(data.Date || data.date || '');
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear(), m = d.getMonth();
        rebuildMonthReport(familyId, y, m).catch(() => {});
        BANKS.forEach((b) => rebuildBankReport(familyId, b.id, y, m).catch(() => {}));
      }
    }

    return NextResponse.json({ id: expense.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to create expense.' }, { status: 500 });
  }
}
