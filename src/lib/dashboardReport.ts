import { getAdminDb } from './firebaseAdmin';
import { autoCategorize } from '@/utils/DescriptionHelper';
import type { QueryDocumentSnapshot } from 'firebase-admin/firestore';

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

function computeStats(
  docs: QueryDocumentSnapshot[],
  includeInactive: boolean
): MonthStats {
  const today = new Date().toISOString().split('T')[0];
  let income = 0, incomeWithFuture = 0, expense = 0;
  let bankIncome = 0, bankExpense = 0, cashIncome = 0, cashExpense = 0;
  const categoryTotals: Record<string, number> = {};
  const incomeItems: MonthStats['incomeItems'] = [];
  let transactionCount = 0;

  docs.forEach(d => {
    const data = d.data();
    if (!includeInactive && (data.status || 'active') !== 'active') return;

    const amount = Math.abs(Number(data.Amount || data.amount || 0));
    if (!amount) return;

    const isIncome = (data.Type || data.type || 'Expense') === 'Income';
    const dateStr = String(data.Date || '');
    const isFuture = !!dateStr && dateStr > today;
    const method = (data['Payment Method'] || data['Payment_Method'] || '').toLowerCase();
    const currency = data.Currency || 'USD';

    // Mirror the client-side logic: only USD tracked in main stats
    if (currency !== 'USD') return;

    if (!isFuture) {
      if (method.includes('cash')) {
        if (isIncome) cashIncome += amount; else cashExpense += amount;
      } else {
        if (isIncome) bankIncome += amount; else bankExpense += amount;
      }
    }

    if (isIncome) {
      incomeWithFuture += amount;
      incomeItems.push({
        date: dateStr,
        description: data.Description || data.description || 'Income',
        amount,
        isFuture,
      });
      if (!isFuture) income += amount;
    } else if (!isFuture) {
      expense += amount;
      transactionCount++;
      const category = autoCategorize(
        data.Description || data.description || '',
        data.Category || data.category
      );
      categoryTotals[category] = (categoryTotals[category] || 0) + amount;
    }
  });

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

// Bank payment method expansion — mirrors the logic in expenses/route.ts
const BANK_ALIASES: Record<string, string[]> = {
  'chip-mong': ['chip mong bank', 'from chipmong bank to acaleda', 'chip mong bank'],
  'acleda':    ['acleda bank', 'from chipmong bank to acaleda'],
};

function matchesBank(method: string, bankId: string): boolean {
  const m = method.toLowerCase();
  const aliases = BANK_ALIASES[bankId] || [bankId.toLowerCase()];
  return aliases.some(a => m.includes(a) || a.includes(m));
}

/**
 * Rebuilds the bank-specific report for one month.
 * Stores the full filtered transaction list so the report page can render
 * the ledger without loading all expenses.
 * Path: families/{familyId}/reports/bank_{bankId}_{year}
 */
export async function rebuildBankReport(
  familyId: string,
  bankId: string,
  year: number,
  month: number
): Promise<void> {
  const db = getAdminDb();
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const [expSnap, configSnap] = await Promise.all([
    db.collection('families').doc(familyId)
      .collection('expenses')
      .where('Date', '>=', monthStart)
      .where('Date', '<=', monthEnd)
      .get(),
    db.collection('families').doc(familyId)
      .collection('settings').doc('config').get(),
  ]);

  const today = new Date().toISOString().split('T')[0];

  // Filter to only bank transactions
  const transactions = expSnap.docs
    .filter(d => {
      const method = (d.data()['Payment Method'] || d.data()['Payment_Method'] || '');
      return matchesBank(method, bankId);
    })
    .map(d => {
      const data = d.data();
      const amount = Math.abs(Number(data.Amount || data.amount || 0));
      const dateStr = String(data.Date || '');
      const category = autoCategorize(
        data.Description || data.description || '',
        data.Category || data.category
      );
      return {
        id: d.id,
        Date: dateStr,
        Description: data.Description || data.description || '',
        Category: category,
        Amount: amount,
        Type: data.Type || data.type || 'Expense',
        'Payment Method': data['Payment Method'] || data['Payment_Method'] || '',
        Currency: data.Currency || 'USD',
        status: data.status || 'active',
        isFuture: !!dateStr && dateStr > today,
      };
    })
    .sort((a, b) => {
      if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
      return 0;
    });

  // Starting balance from config
  const config = configSnap.exists ? (configSnap.data() as any) : {};
  const targetTime = year * 12 + month;
  const bankBalances = (Array.isArray(config?.balances) ? config.balances : [])
    .filter((b: any) => b.bankId === bankId)
    .map((b: any) => ({ year: Number(b.year), month: Number(b.month), amount: Number(b.amount || 0) }))
    .filter((b: any) => Number.isFinite(b.year) && Number.isFinite(b.month))
    .sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
  const anchor = [...bankBalances].reverse().find((r: any) => r.year * 12 + r.month <= targetTime);
  let startingBalance = anchor?.amount || 0;

  // Carry forward transactions from anchor month up to (but not including) target month
  if (anchor && (anchor.year * 12 + anchor.month) < targetTime) {
    const anchorMonthStart = `${anchor.year}-${String(anchor.month + 1).padStart(2, '0')}-01`;
    const prevMonthDate = new Date(year, month, 0);
    const prevMonthEnd = `${prevMonthDate.getFullYear()}-${String(prevMonthDate.getMonth() + 1).padStart(2, '0')}-${String(prevMonthDate.getDate()).padStart(2, '0')}`;

    const carrySnap = await db
      .collection('families').doc(familyId)
      .collection('expenses')
      .where('Date', '>=', anchorMonthStart)
      .where('Date', '<=', prevMonthEnd)
      .get();

    carrySnap.docs.forEach(d => {
      const raw = d.data();
      if ((raw.status || 'active') !== 'active') return;

      const method = String(raw['Payment Method'] || raw['Payment_Method'] || '');
      if (!matchesBank(method, bankId)) return;

      const currency = String(raw.Currency || 'USD');
      if (currency !== 'USD') return;

      const amount = Math.abs(Number(raw.Amount || raw.amount || 0));
      const isIncome = String(raw.Type || raw.type || 'Expense') === 'Income';
      if (isIncome) startingBalance += amount;
      else startingBalance -= amount;
    });
  }

  const docRef = db.collection('families').doc(familyId)
    .collection('reports').doc(`bank_${bankId}_${year}`);

  const docSnap = await docRef.get();
  if (docSnap.exists) {
    await docRef.update({
      [`months.${month}`]: { transactions, startingBalance },
      lastUpdated: new Date().toISOString(),
    });
  } else {
    await docRef.set({
      months: { [month]: { transactions, startingBalance } },
      lastUpdated: new Date().toISOString(),
    });
  }
}

/**
 * Rebuilds the pre-computed summary for one month and writes it into
 * families/{familyId}/reports/dashboard_{year} using a merge so other
 * months in the same document are untouched.
 */
export async function rebuildMonthReport(
  familyId: string,
  year: number,
  month: number
): Promise<void> {
  const db = getAdminDb();
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const snap = await db
    .collection('families').doc(familyId)
    .collection('expenses')
    .where('Date', '>=', monthStart)
    .where('Date', '<=', monthEnd)
    .get();

  const active = computeStats(snap.docs, false);
  const all = computeStats(snap.docs, true);

  const docRef = db
    .collection('families').doc(familyId)
    .collection('reports').doc(`dashboard_${year}`);

  // update() with dot-notation only touches months.{month}, leaving other months intact.
  // Falls back to set() when the doc doesn't exist yet.
  const docSnap = await docRef.get();
  if (docSnap.exists) {
    await docRef.update({
      [`months.${month}`]: { active, all },
      lastUpdated: new Date().toISOString(),
    });
  } else {
    await docRef.set({
      months: { [month]: { active, all } },
      lastUpdated: new Date().toISOString(),
    });
  }
}
