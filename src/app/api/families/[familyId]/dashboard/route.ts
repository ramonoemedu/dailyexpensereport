import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';
import { rebuildMonthReport } from '@/lib/dashboardReport';

const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function emptyMonthStats() {
  return {
    income: 0, incomeWithFuture: 0, expense: 0,
    bankIncome: 0, bankExpense: 0, cashIncome: 0, cashExpense: 0,
    categoryTotals: {}, sortedCategories: [], topCategory: 'None',
    incomeItems: [], transactionCount: 0,
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
    const year = Number(url.searchParams.get('year')) || new Date().getFullYear();
    const month = Number(url.searchParams.get('month') ?? new Date().getMonth());
    const statusFilter = (url.searchParams.get('statusFilter') || 'active') as 'active' | 'all';

    const reportKey = `dashboard_${year}`;
    const [reportRow, settings] = await Promise.all([
      prisma.familyReport.findUnique({ where: { familyId_reportKey: { familyId, reportKey } } }),
      prisma.familySettings.findUnique({ where: { familyId } }),
    ]);

    let reportData = reportRow?.data as any;

    if (!reportData?.months?.[month]) {
      await rebuildMonthReport(familyId, year, month);
      const fresh = await prisma.familyReport.findUnique({ where: { familyId_reportKey: { familyId, reportKey } } });
      reportData = fresh?.data as any;
    }

    const months = (reportData?.months as Record<string, any>) || {};
    const currentMonth = months[month]?.[statusFilter] || emptyMonthStats();

    let yearlyIncome = 0, yearlyExpense = 0;
    const timelineIncome: { x: string; y: number }[] = [];
    const timelineExpense: { x: string; y: number }[] = [];

    MONTH_LABELS.forEach((label, m) => {
      const mData = months[m]?.[statusFilter];
      const inc = mData?.income || 0;
      const exp = mData?.expense || 0;
      yearlyIncome += inc;
      yearlyExpense += exp;
      timelineIncome.push({ x: label, y: parseFloat(inc.toFixed(2)) });
      timelineExpense.push({ x: label, y: parseFloat(exp.toFixed(2)) });
    });

    const config = (settings?.config as any) || {};
    const targetTime = year * 12 + month;

    const normalize = (arr: any[]) =>
      arr
        .map((b) => ({ year: Number(b.year), month: Number(b.month), amount: Number(b.amount || 0) }))
        .filter((b) => Number.isFinite(b.year) && Number.isFinite(b.month))
        .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    const allBankBalances = normalize(Array.isArray(config?.balances) ? config.balances : []);
    const chipMongBalances = normalize(
      Array.isArray(config?.balances) ? config.balances.filter((b: any) => b.bankId === 'chip-mong') : []
    );
    const cashBalances = normalize(Array.isArray(config?.cashBalances) ? config.cashBalances : []);

    const findAnchor = (arr: any[]) => [...arr].reverse().find((r) => r.year * 12 + r.month <= targetTime);

    const startingBalance = findAnchor(allBankBalances)?.amount || 0;
    const bankStarting = findAnchor(chipMongBalances)?.amount || 0;
    const cashStarting = findAnchor(cashBalances)?.amount || 0;

    const topCategories = ((currentMonth.sortedCategories as any[]) || []).slice(0, 10);

    return NextResponse.json({
      monthlyIncome: currentMonth.income,
      monthlyIncomeWithFuture: currentMonth.incomeWithFuture,
      monthlyAmount: currentMonth.expense,
      monthlyTransactions: currentMonth.transactionCount,
      topCategory: currentMonth.topCategory,
      sortedCategories: currentMonth.sortedCategories,
      incomeItems: currentMonth.incomeItems,
      yearlyIncome: parseFloat(yearlyIncome.toFixed(2)),
      yearlyExpense: parseFloat(yearlyExpense.toFixed(2)),
      startingBalance,
      currentBalance: startingBalance + currentMonth.income - currentMonth.expense,
      bankBalance: bankStarting + currentMonth.bankIncome - currentMonth.bankExpense,
      cashBalance: cashStarting + currentMonth.cashIncome - currentMonth.cashExpense,
      timeline: { income: timelineIncome, expense: timelineExpense },
      categories: {
        sales: topCategories.map((c: any) => ({ x: c.name, y: c.value })),
        revenue: topCategories.map(() => ({ x: '', y: 0 })),
      },
      growth: { total: 0, amount: 0 },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to load dashboard data.' }, { status: 500 });
  }
}
