'use client';

import dayjs from "dayjs";
import { autoCategorize } from "@/utils/DescriptionHelper";
import { cacheRead, cacheWrite, cacheInvalidate } from "@/utils/clientCache";

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('authToken');
}

// ─── Dashboard Report API (single call, pre-computed server-side) ─────────────

const dashboardListeners = new Set<(familyId: string) => void>();

export function onDashboardUpdate(cb: (familyId: string) => void): () => void {
  dashboardListeners.add(cb);
  return () => dashboardListeners.delete(cb);
}

const dashboardCacheKey = (familyId: string, year: number, month: number, statusFilter: string) =>
  `dashboard:${familyId}:${year}:${month}:${statusFilter}`;

export function hasDashboardCache(familyId: string, year: number, month: number, statusFilter: string): boolean {
  if (!familyId) return false;
  return cacheRead(dashboardCacheKey(familyId, year, month, statusFilter), Infinity) !== null;
}

export function invalidateDashboardCache(familyId: string) {
  cacheInvalidate(`dashboard:${familyId}`);
}

export async function getDashboardData(
  month: number,
  year: number,
  familyId: string,
  statusFilter: 'active' | 'all' = 'active'
): Promise<any> {
  const key = dashboardCacheKey(familyId, year, month, statusFilter);
  const cached = cacheRead<any>(key, Infinity);

  const fetchFresh = async () => {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const r = await fetch(
      `/api/families/${familyId}/dashboard?year=${year}&month=${month}&statusFilter=${statusFilter}`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) {
      const msg = await r.json().then(j => j.error).catch(() => r.statusText);
      throw new Error(`Dashboard API error: ${msg}`);
    }
    return r.json();
  };

  if (cached) {
    fetchFresh()
      .then(fresh => {
        const sig = (d: any) =>
          `${d.monthlyIncome}|${d.monthlyAmount}|${d.yearlyIncome}|${d.yearlyExpense}|${d.bankBalance}|${d.cashBalance}`;
        if (sig(fresh) !== sig(cached)) {
          cacheWrite(key, fresh);
          dashboardListeners.forEach(cb => cb(familyId));
        }
      })
      .catch(() => {});
    return cached;
  }

  const fresh = await fetchFresh();
  cacheWrite(key, fresh);
  return fresh;
}

// ─── All-expenses cache (used by getClearPortStats for client-side computation) ─

type ExpenseRow = Record<string, any>;
const rawDocsInflight = new Map<string, Promise<ExpenseRow[]>>();
const rawDocsCache = new Map<string, { docs: ExpenseRow[]; ts: number }>();
const MEM_TTL_MS = 30_000;
const lsKey = (familyId: string) => `dex_rawdocs:${familyId}`;

function docsSignature(docs: ExpenseRow[]): string {
  return docs.length + ':' + docs.map(d => d.id).sort().join(',');
}

function lsRead(familyId: string): ExpenseRow[] | null {
  try {
    const raw = localStorage.getItem(lsKey(familyId));
    if (!raw) return null;
    const entry: { docs: ExpenseRow[]; ts: number } = JSON.parse(raw);
    return entry.docs;
  } catch { return null; }
}

function lsWrite(familyId: string, docs: ExpenseRow[]) {
  try { localStorage.setItem(lsKey(familyId), JSON.stringify({ docs, ts: Date.now() })); } catch {}
}

const dataUpdateListeners = new Set<(familyId: string) => void>();

export function onDataUpdate(cb: (familyId: string) => void): () => void {
  dataUpdateListeners.add(cb);
  return () => dataUpdateListeners.delete(cb);
}

export function hasCachedDocs(familyId: string): boolean {
  if (!familyId) return false;
  if (rawDocsCache.has(familyId)) return true;
  try { return !!localStorage.getItem(lsKey(familyId)); } catch { return false; }
}

export function invalidateFamilyCache(familyId: string) {
  rawDocsCache.delete(familyId);
  rawDocsInflight.delete(familyId);
  try { localStorage.removeItem(lsKey(familyId)); } catch {}
  invalidateDashboardCache(familyId);
  invalidateBankReportCache(familyId);
  cacheInvalidate(`expenses:${familyId}`);
}

async function fetchFreshExpenses(familyId: string): Promise<ExpenseRow[]> {
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const r = await fetch(
    `/api/families/${familyId}/expenses?all=true`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) throw new Error('Failed to fetch expenses');
  const data = await r.json();
  return data.rows || [];
}

async function getFamilyExpenseDocs(familyId: string): Promise<ExpenseRow[]> {
  const mem = rawDocsCache.get(familyId);
  if (mem && Date.now() - mem.ts < MEM_TTL_MS) return mem.docs;

  const lsDocs = lsRead(familyId);
  if (lsDocs) {
    rawDocsCache.set(familyId, { docs: lsDocs, ts: Date.now() });

    if (!rawDocsInflight.has(familyId)) {
      const cachedSig = docsSignature(lsDocs);
      const bgPromise = fetchFreshExpenses(familyId).then(freshDocs => {
        rawDocsInflight.delete(familyId);
        if (docsSignature(freshDocs) !== cachedSig) {
          rawDocsCache.set(familyId, { docs: freshDocs, ts: Date.now() });
          lsWrite(familyId, freshDocs);
          dataUpdateListeners.forEach(cb => cb(familyId));
        }
        return freshDocs;
      }).catch(err => { rawDocsInflight.delete(familyId); throw err; });
      rawDocsInflight.set(familyId, bgPromise);
    }

    return lsDocs;
  }

  const inflight = rawDocsInflight.get(familyId);
  if (inflight) return inflight;

  const promise = fetchFreshExpenses(familyId).then(docs => {
    rawDocsCache.set(familyId, { docs, ts: Date.now() });
    lsWrite(familyId, docs);
    rawDocsInflight.delete(familyId);
    return docs;
  }).catch(err => { rawDocsInflight.delete(familyId); throw err; });

  rawDocsInflight.set(familyId, promise);
  return promise;
}


export async function getClearPortStats(month?: number, year?: number, options?: {
  paymentMethodFilter?: string | string[],
  currencyFilter?: string,
  bankId?: string,
  statusFilter?: 'all' | 'active' | 'inactive',
  familyId?: string
}) {
  try {
    const familyId = options?.familyId;
    if (!familyId) throw new Error("No familyId set for stats");

    const rawDocs = await getFamilyExpenseDocs(familyId);
    const now = dayjs();
    const targetMonth = month !== undefined ? month : now.month();
    const targetYear = year !== undefined ? year : now.year();
    const targetTime = targetYear * 12 + targetMonth;

    let monthlyTransactions = 0;
    let monthlyAmount = 0;
    let monthlyIncome = 0;
    let monthlyIncomeWithFuture = 0;
    const monthlyIncomeItems: any[] = [];
    const monthlyTransactionsList: any[] = [];
    let maxExpense = 0;
    let yearlyIncome = 0;
    let yearlyExpense = 0;
    const categoryTotals: Record<string, number> = {};

    let startingBalance = 0;
    let bankStartingBalance = 0;
    let cashStartingBalance = 0;

    let bankMonthlyIncome = 0;
    let bankMonthlyExpense = 0;
    let cashMonthlyIncome = 0;
    let cashMonthlyExpense = 0;

    try {
      const token = getToken();
      const isCashReport = options?.paymentMethodFilter === "Cash" || (Array.isArray(options?.paymentMethodFilter) && options?.paymentMethodFilter.includes("Cash") && options?.paymentMethodFilter.length === 1);

      const headers: HeadersInit = token ? { Authorization: `Bearer ${token}` } : {};
      const [bankRes, cashRes] = await Promise.all([
        fetch(`/api/families/${familyId}/balances`, { headers }),
        fetch(`/api/families/${familyId}/cash-balances`, { headers }),
      ]);
      const { balances: familyBankBalancesRaw = [] } = bankRes.ok ? await bankRes.json() : { balances: [] };
      const { balances: familyCashBalancesRaw = [] } = cashRes.ok ? await cashRes.json() : { balances: [] };

      const normalize = (arr: any[], useKHR = false) => arr
        .map((b) => ({
          year: Number(b.year),
          month: Number(b.month),
          amount: Number(useKHR ? (b.amountKHR || 0) : (b.amount || 0)),
        }))
        .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.month))
        .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

      let balances = isCashReport
        ? normalize(familyCashBalancesRaw, options?.currencyFilter === "KHR")
        : normalize(options?.bankId ? familyBankBalancesRaw.filter((b: any) => b.bankId === options.bankId) : familyBankBalancesRaw, false);

      let bankBalances = normalize(familyBankBalancesRaw.filter((b: any) => b.bankId === "chip-mong"), false);
      let cashBalances = normalize(familyCashBalancesRaw, false);

      const anchor = [...balances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (anchor) startingBalance = anchor.amount;

      const bankAnchor = [...bankBalances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (bankAnchor) bankStartingBalance = bankAnchor.amount;

      const cashAnchor = [...cashBalances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (cashAnchor) cashStartingBalance = cashAnchor.amount;

    } catch (e) { console.error("Balance fetch error:", e); }

    rawDocs.forEach((row) => {
      const status = row.status || 'active';
      const isRecordActive = status === 'active';

      if (options?.statusFilter && options.statusFilter !== 'all') {
        if (options.statusFilter === 'active' && !isRecordActive) return;
        if (options.statusFilter === 'inactive' && isRecordActive) return;
      } else if (!options?.statusFilter && !isRecordActive) {
        return;
      }

      const methodRaw = row["Payment Method"] || row["Payment_Method"] || "";
      const method = methodRaw.toString().toLowerCase().trim();
      const amount = Math.abs(parseFloat(row.Amount || row.amount || 0));
      const currency = row["Currency"] || row["currency"] || "USD";
      const isIncome = (row.Type || row.type || "Expense").toLowerCase() === "income";
      const dateStr = row.Date || row.date || row.createdAt;

      if (!dateStr) return;
      const date = dayjs(dateStr);
      if (!date.isValid()) return;

      const isFuture = date.isAfter(now, 'day');
      const isTargetMonth = date.month() === targetMonth && date.year() === targetYear;
      const isTargetYear = date.year() === targetYear;

      if (!isFuture) {
        if (method.includes("cash")) {
          if (isIncome) cashMonthlyIncome += (isTargetMonth ? amount : 0);
          else cashMonthlyExpense += (isTargetMonth ? amount : 0);
        } else {
          if (isIncome) bankMonthlyIncome += (isTargetMonth ? amount : 0);
          else bankMonthlyExpense += (isTargetMonth ? amount : 0);
        }
      }

      let passMethodFilter = true;
      if (options?.paymentMethodFilter) {
        const filterArray = Array.isArray(options.paymentMethodFilter) ? options.paymentMethodFilter : [options.paymentMethodFilter];
        const expandedFilters = filterArray.flatMap(f => {
          const lf = f.toLowerCase();
          if (lf.includes("chip mong")) return [lf, "from chipmong bank to acaleda", "chip mong bank"];
          if (lf.includes("acleda")) return [lf, "acleda bank", "from chipmong bank to acaleda"];
          return [lf];
        });
        passMethodFilter = expandedFilters.some(f => method.includes(f) || f.includes(method));
      }

      let passCurrencyFilter = true;
      if (options?.currencyFilter) passCurrencyFilter = currency === options.currencyFilter;

      if (passMethodFilter && passCurrencyFilter) {
        if (isTargetYear && !isFuture) {
          if (isIncome) yearlyIncome += amount;
          else yearlyExpense += amount;
        }

        if (isTargetMonth) {
          const category = autoCategorize(row.Description || row.description || "", row.Category || row.category);

          monthlyTransactionsList.push({
            id: row.id, Date: dateStr, Description: row.Description || row.description || "No Description",
            Category: category, Amount: amount, Type: isIncome ? "Income" : "Expense",
            "Payment Method": methodRaw, Currency: currency, isFuture, status
          });

          if (isIncome) {
            monthlyIncomeWithFuture += amount;
            if (!isFuture) {
              monthlyIncome += amount;
              monthlyIncomeItems.push({ date: dateStr, description: row.Description || row.description || "Income", amount, isFuture });
            }
          } else if (!isFuture) {
            monthlyTransactions++;
            monthlyAmount += amount;
            if (amount > maxExpense) maxExpense = amount;
            categoryTotals[category] = (categoryTotals[category] || 0) + amount;
          }
        }
      }
    });

    monthlyIncomeItems.sort((a, b) => a.date.localeCompare(b.date));
    monthlyTransactionsList.sort((a, b) => a.Date.localeCompare(b.Date));

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    const result = {
      monthlyTransactions, monthlyAmount, monthlyIncome, monthlyIncomeWithFuture,
      monthlyIncomeItems, monthlyTransactionsList, maxExpense, yearlyIncome, yearlyExpense,
      topCategory: sortedCategories[0]?.name || "None",
      sortedCategories, targetMonth, targetYear, startingBalance,
      currentBalance: startingBalance + monthlyIncome - monthlyAmount,
      bankBalance: bankStartingBalance + bankMonthlyIncome - bankMonthlyExpense,
      cashBalance: cashStartingBalance + cashMonthlyIncome - cashMonthlyExpense,
      growth: { total: 10, amount: 5 }
    };

    return result;
  } catch (error) {
    console.error("Error fetching expense stats:", error);
    return {
      monthlyTransactions: 0, monthlyAmount: 0, monthlyIncome: 0, monthlyIncomeWithFuture: 0,
      maxExpense: 0, yearlyIncome: 0, yearlyExpense: 0, topCategory: "None",
      targetMonth: 0, targetYear: 2026, startingBalance: 0, currentBalance: 0,
      bankBalance: 0, cashBalance: 0, growth: { total: 0, amount: 0 }
    };
  }
}

export async function getClearanceTimelineData(year?: number, familyId?: string) {
  if (!familyId) return { income: [], expense: [] };
  try {
    const data = await getDashboardData(dayjs().month(), year || dayjs().year(), familyId);
    return data.timeline || { income: [], expense: [] };
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    return { income: [], expense: [] };
  }
}

export async function getWeeksProfitData(month?: number, year?: number, familyId?: string) {
  if (!familyId) return { sales: [], revenue: [] };
  try {
    const m = month !== undefined ? month : dayjs().month();
    const y = year || dayjs().year();
    const data = await getDashboardData(m, y, familyId);
    return data.categories || { sales: [], revenue: [] };
  } catch (error) {
    console.error("Error fetching category data:", error);
    return { sales: [], revenue: [] };
  }
}

export async function getPaymentsOverviewData(year?: number, familyId?: string) {
  return getClearanceTimelineData(year, familyId);
}

// ─── Bank Report API ──────────────────────────────────────────────────────────

const bankReportCacheKey = (familyId: string, bankId: string, year: number, month: number) =>
  `bankreport:${familyId}:${bankId}:${year}:${month}`;

export function hasBankReportCache(familyId: string, bankId: string, year: number, month: number): boolean {
  if (!familyId) return false;
  return cacheRead(bankReportCacheKey(familyId, bankId, year, month), Infinity) !== null;
}

export function invalidateBankReportCache(familyId: string) {
  cacheInvalidate(`bankreport:${familyId}`);
}

const bankReportListeners = new Set<(familyId: string) => void>();

export function onBankReportUpdate(cb: (familyId: string) => void): () => void {
  bankReportListeners.add(cb);
  return () => bankReportListeners.delete(cb);
}

export async function rebuildBankReportData(
  familyId: string,
  bankId: string,
  year: number,
  month: number
): Promise<{ transactions: any[]; startingBalance: number }> {
  const key = bankReportCacheKey(familyId, bankId, year, month);
  const token = getToken();
  if (!token) throw new Error('Not authenticated');
  const r = await fetch(
    `/api/families/${familyId}/bank-report/${bankId}?year=${year}&month=${month}&rebuild=true`,
    { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
  );
  if (!r.ok) {
    const msg = await r.json().then(j => j.error).catch(() => r.statusText);
    throw new Error(`Bank report rebuild error: ${msg}`);
  }
  const fresh = await r.json();
  cacheWrite(key, fresh);
  bankReportListeners.forEach(cb => cb(familyId));
  return fresh;
}

export async function getBankReportData(
  familyId: string,
  bankId: string,
  year: number,
  month: number
): Promise<{ transactions: any[]; startingBalance: number }> {
  const key = bankReportCacheKey(familyId, bankId, year, month);
  const cached = cacheRead<any>(key, Infinity);

  const fetchFresh = async () => {
    const token = getToken();
    if (!token) throw new Error('Not authenticated');
    const r = await fetch(
      `/api/families/${familyId}/bank-report/${bankId}?year=${year}&month=${month}`,
      { cache: 'no-store', headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) {
      const msg = await r.json().then(j => j.error).catch(() => r.statusText);
      throw new Error(`Bank report API error: ${msg}`);
    }
    return r.json();
  };

  if (cached) {
    const cacheAge = Date.now() - (cached._cachedAt || 0);
    if (cacheAge > 5 * 60_000) {
      fetchFresh().then(fresh => {
        const sig = (d: any) => {
          const txns = d.transactions || [];
          const totalOut = txns.reduce((s: number, t: any) => t.Type === 'Expense' && (t.Currency || 'USD') === 'USD' ? s + t.Amount : s, 0);
          const totalIn = txns.reduce((s: number, t: any) => t.Type === 'Income' && (t.Currency || 'USD') === 'USD' ? s + t.Amount : s, 0);
          return `${txns.length}:${d.startingBalance || 0}:${totalIn.toFixed(2)}:${totalOut.toFixed(2)}`;
        };
        if (sig(fresh) !== sig(cached)) {
          cacheWrite(key, { ...fresh, _cachedAt: Date.now() });
          bankReportListeners.forEach(cb => cb(familyId));
        }
      }).catch(() => {});
    }
    return cached;
  }

  const fresh = await fetchFresh();
  cacheWrite(key, fresh);
  return fresh;
}

export async function getDevicesUsedData(_timeFrame?: string) {
  return [
    { name: "Desktop", percentage: 0.65, amount: 1625 },
    { name: "Tablet", percentage: 0.1, amount: 250 },
    { name: "Mobile", percentage: 0.2, amount: 500 },
    { name: "Unknown", percentage: 0.05, amount: 125 },
  ];
}

export async function getCampaignVisitorsData() {
  return { total_visitors: 0, performance: 0, chart: [] };
}

export async function getVisitorsAnalyticsData() {
  return [];
}

export async function getCostsPerInteractionData() {
  return { avg_cost: 0, growth: 0, chart: [] };
}
