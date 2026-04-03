'use client';

import { db, auth } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import dayjs from "dayjs";
import { autoCategorize } from "@/utils/DescriptionHelper";
import { cacheRead, cacheWrite, cacheInvalidate } from "@/utils/clientCache";

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
  const cached = cacheRead<any>(key, Infinity); // No expiry — always serve cache, always bg-check

  const fetchFresh = async () => {
    const token = await auth.currentUser?.getIdToken();
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
    // Background revalidation: check if report doc has newer data
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
type RawDocsEntry = { docs: Array<{ id: string; data: Record<string, any> }> };
const rawDocsInflight = new Map<string, Promise<RawDocsEntry["docs"]>>();
const rawDocsCache = new Map<string, { docs: RawDocsEntry["docs"]; ts: number }>();
const MEM_TTL_MS = 30_000; // 30 seconds — prevents duplicate bg fetches within same session
const lsKey = (familyId: string) => `dex_rawdocs:${familyId}`;

function docsSignature(docs: RawDocsEntry["docs"]): string {
  return docs.length + ':' + docs.map(d => d.id).sort().join(',');
}

function lsRead(familyId: string): RawDocsEntry["docs"] | null {
  try {
    const raw = localStorage.getItem(lsKey(familyId));
    if (!raw) return null;
    const entry: { docs: RawDocsEntry["docs"]; ts: number } = JSON.parse(raw);
    return entry.docs; // No TTL expiry — always serve cached, always bg-check
  } catch { return null; }
}

function lsWrite(familyId: string, docs: RawDocsEntry["docs"]) {
  try { localStorage.setItem(lsKey(familyId), JSON.stringify({ docs, ts: Date.now() })); } catch {}
}

// Listeners notified when background revalidation finds new data
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
  // Also clear pre-computed report caches so next load fetches fresh data
  invalidateDashboardCache(familyId);
  invalidateBankReportCache(familyId);
  // Clear server-paginated expense list cache
  cacheInvalidate(`expenses:${familyId}`);
}

async function getFamilyExpenseDocs(familyId: string): Promise<RawDocsEntry["docs"]> {
  // 1. In-memory hit (fastest)
  const mem = rawDocsCache.get(familyId);
  if (mem && Date.now() - mem.ts < MEM_TTL_MS) return mem.docs;

  // 2. localStorage hit → return immediately, revalidate in background
  const lsDocs = lsRead(familyId);
  if (lsDocs) {
    rawDocsCache.set(familyId, { docs: lsDocs, ts: Date.now() });

    // Background revalidation (deduplicated)
    if (!rawDocsInflight.has(familyId)) {
      const cachedSig = docsSignature(lsDocs);
      const bgPromise = getDocs(collection(db, "families", familyId, "expenses")).then(snap => {
        const freshDocs = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, any> }));
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

  // 3. No cache — fresh fetch (first load)
  const inflight = rawDocsInflight.get(familyId);
  if (inflight) return inflight;

  const promise = getDocs(collection(db, "families", familyId, "expenses")).then(snap => {
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, any> }));
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

    // Core stats
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

    // Balances
    let startingBalance = 0;
    let bankStartingBalance = 0;
    let cashStartingBalance = 0;
    
    let bankMonthlyIncome = 0;
    let bankMonthlyExpense = 0;
    let cashMonthlyIncome = 0;
    let cashMonthlyExpense = 0;

    try {
      const isCashReport = options?.paymentMethodFilter === "Cash" || (Array.isArray(options?.paymentMethodFilter) && options?.paymentMethodFilter.includes("Cash") && options?.paymentMethodFilter.length === 1);

      const configSnap = await getDoc(doc(db, "families", familyId, "settings", "config"));
      const config = configSnap.exists() ? configSnap.data() as any : {};
      const familyBankBalances = Array.isArray(config?.balances) ? config.balances : [];
      const familyCashBalances = Array.isArray(config?.cashBalances) ? config.cashBalances : [];

      const normalize = (arr: any[], useKHR = false) => arr
        .map((b) => ({
          year: Number(b.year),
          month: Number(b.month),
          amount: Number(useKHR ? (b.amountKHR || 0) : (b.amount || 0)),
        }))
        .filter((r) => Number.isFinite(r.year) && Number.isFinite(r.month))
        .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

      let balances = isCashReport
        ? normalize(familyCashBalances, options?.currencyFilter === "KHR")
        : normalize(options?.bankId ? familyBankBalances.filter((b: any) => b.bankId === options.bankId) : familyBankBalances, false);

      let bankBalances = normalize(familyBankBalances.filter((b: any) => b.bankId === "chip-mong"), false);
      let cashBalances = normalize(familyCashBalances, false);

      const anchor = [...balances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (anchor) startingBalance = anchor.amount;

      const bankAnchor = [...bankBalances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (bankAnchor) bankStartingBalance = bankAnchor.amount;

      const cashAnchor = [...cashBalances].reverse().find(r => (r.year * 12 + r.month) <= targetTime);
      if (cashAnchor) cashStartingBalance = cashAnchor.amount;

    } catch (e) { console.error("Balance fetch error:", e); }

    rawDocs.forEach(({ id, data: rawData }) => {
      const doc = { id };
      const data = rawData;
      const status = data.status || 'active';
      const isRecordActive = status === 'active';

      // Global status filter (respects 'active', 'inactive', 'all')
      if (options?.statusFilter && options.statusFilter !== 'all') {
        if (options.statusFilter === 'active' && !isRecordActive) return;
        if (options.statusFilter === 'inactive' && isRecordActive) return;
      } else if (!options?.statusFilter && !isRecordActive) {
        // Default behavior for dashboard is Active only
        return;
      }

      const methodRaw = data["Payment Method"] || data["Payment_Method"] || "";
      const method = methodRaw.toString().toLowerCase().trim();
      const amount = Math.abs(parseFloat(data.Amount || data.amount || 0));
      const currency = data["Currency"] || data["currency"] || "USD";
      const isIncome = (data.Type || data.type || "Expense").toLowerCase() === "income";
      const dateStr = data.Date || data.date || data.createdAt;
      
      if (!dateStr) return;
      const date = dayjs(dateStr);
      if (!date.isValid()) return;
      
      const isFuture = date.isAfter(now, 'day');
      const isTargetMonth = date.month() === targetMonth && date.year() === targetYear;
      const isTargetYear = date.year() === targetYear;

      // 1. Bank/Cash Balance logic (Dashboard)
      if (!isFuture) {
        if (method.includes("cash")) {
          if (isIncome) cashMonthlyIncome += (isTargetMonth ? amount : 0);
          else cashMonthlyExpense += (isTargetMonth ? amount : 0);
        } else {
          if (isIncome) bankMonthlyIncome += (isTargetMonth ? amount : 0);
          else bankMonthlyExpense += (isTargetMonth ? amount : 0);
        }
      }

      // 2. Filtered Stats (Cards & Reports)
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
          const category = autoCategorize(data.Description || data.description || "", data.Category || data.category);
          
          monthlyTransactionsList.push({
            id: doc.id, Date: dateStr, Description: data.Description || data.description || "No Description",
            Category: category, Amount: amount, Type: isIncome ? "Income" : "Expense",
            "Payment Method": methodRaw, Currency: currency, isFuture, status
          });

          if (isIncome) {
            monthlyIncomeWithFuture += amount;
            if (!isFuture) {
              monthlyIncome += amount;
              monthlyIncomeItems.push({ date: dateStr, description: data.Description || data.description || "Income", amount, isFuture });
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
    // Use the pre-computed dashboard report (current month of that year to get the full timeline)
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

export async function getBankReportData(
  familyId: string,
  bankId: string,
  year: number,
  month: number
): Promise<{ transactions: any[]; startingBalance: number }> {
  const key = bankReportCacheKey(familyId, bankId, year, month);
  const cached = cacheRead<any>(key, Infinity);

  const fetchFresh = async () => {
    const token = await auth.currentUser?.getIdToken();
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
    fetchFresh().then(fresh => {
      const sig = (d: any) => d.transactions?.length + ':' + (d.startingBalance || 0);
      if (sig(fresh) !== sig(cached)) {
        cacheWrite(key, fresh);
        bankReportListeners.forEach(cb => cb(familyId));
      }
    }).catch(() => {});
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