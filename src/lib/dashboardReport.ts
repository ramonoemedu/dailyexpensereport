import { getPrisma } from '@/lib/prisma';
import { autoCategorize } from '@/utils/DescriptionHelper';
import { Expense } from '@prisma/client';

export interface MonthStats {
  income: number;
  incomeWithFuture: number;
  expense: number;
  bankIncome: number;
  bankExpense: number;
  cashIncome: number;
  cashExpense: number;
  categoryTotals: Record<string, number>;
  sortedCategories: Array<{ name: string; value: number }>;
  topCategory: string;
  incomeItems: Array<{ date: string; description: string; amount: number; isFuture: boolean }>;
  transactionCount: number;
}

function computeStats(expenses: Expense[], includeInactive: boolean): MonthStats {
  const today = new Date().toISOString().split('T')[0];
  let income = 0, incomeWithFuture = 0, expense = 0;
  let bankIncome = 0, bankExpense = 0, cashIncome = 0, cashExpense = 0;
  const categoryTotals: Record<string, number> = {};
  const incomeItems: MonthStats['incomeItems'] = [];
  let transactionCount = 0;

  for (const e of expenses) {
    if (!includeInactive && e.status !== 'active') continue;
    const amount = Math.abs(e.amount);
    if (!amount) continue;
    if (e.currency !== 'USD') continue;

    const isIncome = e.type === 'Income';
    const dateStr = e.date;
    const isFuture = !!dateStr && dateStr > today;
    const method = e.paymentMethod.toLowerCase();

    if (!isFuture) {
      if (method.includes('cash')) {
        if (isIncome) cashIncome += amount; else cashExpense += amount;
      } else {
        if (isIncome) bankIncome += amount; else bankExpense += amount;
      }
    }

    if (isIncome) {
      incomeWithFuture += amount;
      incomeItems.push({ date: dateStr, description: e.description || 'Income', amount, isFuture });
      if (!isFuture) income += amount;
    } else if (!isFuture) {
      expense += amount;
      transactionCount++;
      const category = autoCategorize(e.description, e.category);
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
  }

  incomeItems.sort((a, b) => a.date.localeCompare(b.date));
  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const r = (n: number) => parseFloat(n.toFixed(2));
  return {
    income: r(income), incomeWithFuture: r(incomeWithFuture), expense: r(expense),
    bankIncome: r(bankIncome), bankExpense: r(bankExpense),
    cashIncome: r(cashIncome), cashExpense: r(cashExpense),
    categoryTotals, sortedCategories,
    topCategory: sortedCategories[0]?.name || 'None',
    incomeItems, transactionCount,
  };
}

const BANK_ALIASES: Record<string, string[]> = {
  'chip-mong': ['chip mong bank', 'from chipmong bank to acaleda', 'chip mong bank'],
  'acleda': ['acleda bank', 'from chipmong bank to acaleda'],
};

function matchesBank(method: string, bankId: string): boolean {
  const m = method.toLowerCase();
  const aliases = BANK_ALIASES[bankId] || [bankId.toLowerCase()];
  return aliases.some((a) => m.includes(a) || a.includes(m));
}

export async function rebuildBankReport(
  familyId: string,
  bankId: string,
  year: number,
  month: number
): Promise<void> {
  const prisma = getPrisma();
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const [expenses, settings] = await Promise.all([
    prisma.expense.findMany({
      where: { familyId, date: { gte: monthStart, lte: monthEnd } },
    }),
    prisma.familySettings.findUnique({ where: { familyId } }),
  ]);

  const today = new Date().toISOString().split('T')[0];
  const transactions = expenses
    .filter((e) => matchesBank(e.paymentMethod, bankId))
    .map((e) => ({
      id: e.id,
      Date: e.date,
      Description: e.description,
      Category: autoCategorize(e.description, e.category),
      Amount: Math.abs(e.amount),
      Type: e.type,
      'Payment Method': e.paymentMethod,
      Currency: e.currency,
      status: e.status,
      isFuture: !!e.date && e.date > today,
    }))
    .sort((a, b) => a.Date.localeCompare(b.Date));

  const config = (settings?.config as any) || {};
  const targetTime = year * 12 + month;
  const bankBalances = (Array.isArray(config?.balances) ? config.balances : [])
    .filter((b: any) => b.bankId === bankId)
    .map((b: any) => ({ year: Number(b.year), month: Number(b.month), amount: Number(b.amount || 0) }))
    .filter((b: any) => Number.isFinite(b.year) && Number.isFinite(b.month))
    .sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

  const anchor = [...bankBalances].reverse().find((r: any) => r.year * 12 + r.month <= targetTime);
  let startingBalance = anchor?.amount || 0;

  if (anchor && (anchor.year * 12 + anchor.month) < targetTime) {
    const anchorMonthStart = `${anchor.year}-${String(anchor.month + 1).padStart(2, '0')}-01`;
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthEnd = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;

    const carryExpenses = await prisma.expense.findMany({
      where: { familyId, date: { gte: anchorMonthStart, lte: prevMonthEnd }, status: 'active' },
    });

    carryExpenses.forEach((e) => {
      if (!matchesBank(e.paymentMethod, bankId)) return;
      if (e.currency !== 'USD') return;
      const amount = Math.abs(e.amount);
      if (e.type === 'Income') startingBalance += amount;
      else startingBalance -= amount;
    });
  }

  const reportKey = `bank_${bankId}_${year}`;
  const existing = await prisma.familyReport.findUnique({ where: { familyId_reportKey: { familyId, reportKey } } });
  const data = existing?.data as any || {};
  data.months = data.months || {};
  data.months[month] = { transactions, startingBalance };
  data.lastUpdated = new Date().toISOString();

  await prisma.familyReport.upsert({
    where: { familyId_reportKey: { familyId, reportKey } },
    create: { familyId, reportKey, data, updatedAt: new Date() },
    update: { data, updatedAt: new Date() },
  });
}

export async function rebuildMonthReport(
  familyId: string,
  year: number,
  month: number
): Promise<void> {
  const prisma = getPrisma();
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const expenses = await prisma.expense.findMany({
    where: { familyId, date: { gte: monthStart, lte: monthEnd } },
  });

  const active = computeStats(expenses, false);
  const all = computeStats(expenses, true);

  const reportKey = `dashboard_${year}`;
  const existing = await prisma.familyReport.findUnique({ where: { familyId_reportKey: { familyId, reportKey } } });
  const data = existing?.data as any || {};
  data.months = data.months || {};
  data.months[month] = { active, all };
  data.lastUpdated = new Date().toISOString();

  await prisma.familyReport.upsert({
    where: { familyId_reportKey: { familyId, reportKey } },
    create: { familyId, reportKey, data, updatedAt: new Date() },
    update: { data, updatedAt: new Date() },
  });
}
