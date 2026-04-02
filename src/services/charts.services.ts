'use client';

import { db } from "@/lib/firebase";
import { collection, getDocs, doc, getDoc } from "firebase/firestore";
import { sanitizeKey } from "@/utils/KeySanitizer";
import dayjs from "dayjs";
import { autoCategorize } from "@/utils/DescriptionHelper";
// In-flight dedup only — no TTL cache (real-time)
type RawDocsEntry = { docs: Array<{ id: string; data: Record<string, any> }> };
const rawDocsInflight = new Map<string, Promise<RawDocsEntry["docs"]>>();

export function invalidateFamilyCache(_familyId: string) {
  // No-op: caching removed, kept for call-site compatibility
}

async function getFamilyExpenseDocs(familyId: string): Promise<RawDocsEntry["docs"]> {
  // Deduplicate concurrent calls — return the same in-flight Promise
  const inflight = rawDocsInflight.get(familyId);
  if (inflight) return inflight;

  const promise = getDocs(collection(db, "families", familyId, "expenses")).then(snap => {
    const docs = snap.docs.map(d => ({ id: d.id, data: d.data() as Record<string, any> }));
    rawDocsInflight.delete(familyId);
    return docs;
  }).catch(err => {
    rawDocsInflight.delete(familyId);
    throw err;
  });

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
  try {
    if (!familyId) throw new Error("No familyId set for timeline");
    const rawDocs = await getFamilyExpenseDocs(familyId);
    const targetYear = year || dayjs().year();
    const incomeMonthly: Record<string, number> = {};
    const expenseMonthly: Record<string, number> = {};

    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach(m => { incomeMonthly[m] = 0; expenseMonthly[m] = 0; });

    const now = dayjs();
    rawDocs.forEach(({ data }) => {
      if (data.status === 'inactive') return;

      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (dateStr) {
        const date = dayjs(dateStr);
        if (date.isAfter(now, 'day')) return;

        if (date.year() === targetYear) {
          const month = months[date.month()];
          let rawAmount = data[sanitizeKey("Amount")] || data["Amount"] || "0";
          if (typeof rawAmount === "string") {
            rawAmount = rawAmount.replace(/,/g, ".");
          }
          const amount = Math.abs(parseFloat(rawAmount));
          if (isNaN(amount) || amount === 0) return;

          if (data["Type"] === "Income" || data["type"] === "Income") incomeMonthly[month] += amount;
          else expenseMonthly[month] += amount;
        }
      }
    });

    const result = {
      income: months.map(m => ({ x: m, y: parseFloat(incomeMonthly[m].toFixed(2)) })),
      expense: months.map(m => ({ x: m, y: parseFloat(expenseMonthly[m].toFixed(2)) }))
    };

    return result;
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    return { income: [], expense: [] };
  }
}

export async function getWeeksProfitData(month?: number, year?: number, familyId?: string) {
  try {
    if (!familyId) throw new Error("No familyId set for weeks profit");
    const rawDocs = await getFamilyExpenseDocs(familyId);
    const now = dayjs();
    const targetMonth = month !== undefined ? month : now.month();
    const targetYear = year !== undefined ? year : now.year();
    const categoryTotals: Record<string, number> = {};

    rawDocs.forEach(({ data }) => {
      if (data.status === 'inactive') return;

      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (!dateStr) return;

      const date = dayjs(dateStr);
      if (date.isAfter(now, 'day')) return;

      if (date.month() === targetMonth && date.year() === targetYear) {
        if (data.Type !== "Income" && data.type !== "Income") {
          const category = autoCategorize(data.Description || data.description || "", data.Category || data.category);
          let rawAmount = data.Amount || data.amount || 0;
          if (typeof rawAmount === "string") {
            rawAmount = rawAmount.replace(/,/g, ".");
          }
          const amount = Math.abs(parseFloat(rawAmount));
          if (isNaN(amount) || amount === 0) return;
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }
    });

    const topCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10);

    const result = {
      sales: topCategories.map(([name, value]) => ({ x: name, y: parseFloat(value.toFixed(2)) })),
      revenue: topCategories.map(() => ({ x: "", y: 0 })),
    };

    return result;
  } catch (error) {
    console.error("Error fetching category data:", error);
    return { sales: [], revenue: [] };
  }
}

export async function getPaymentsOverviewData(year?: number, familyId?: string) {
  return getClearanceTimelineData(year, familyId);
}

export async function getDevicesUsedData(timeFrame?: string) {
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