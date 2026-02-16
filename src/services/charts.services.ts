import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy, doc, getDoc } from "firebase/firestore";
import { sanitizeKey } from "@/utils/KeySanitizer";
import dayjs from "dayjs";
import { autoCategorize } from "@/utils/DescriptionHelper";

export async function getClearPortStats(month?: number, year?: number) {
  try {
    const snapshot = await getDocs(collection(db, "expenses"));
    const now = dayjs();
    const targetMonth = month !== undefined ? month : now.month();
    const targetYear = year !== undefined ? year : now.year();
    
    let monthlyTransactions = 0;
    let monthlyAmount = 0;
    let monthlyIncome = 0;
    let monthlyIncomeWithFuture = 0;
    let monthlyIncomeItems: any[] = [];
    let monthlyTransactionsList: any[] = [];
    let maxExpense = 0;
    
    let yearlyIncome = 0;
    let yearlyExpense = 0;
    let totalBalance = 0;

    // Fetch Starting Balance for the selected month/year
    let startingBalance = 0;
    try {
      const balanceDoc = await getDoc(doc(db, "settings", `balance_${targetYear}_${targetMonth}`));
      if (balanceDoc.exists()) {
        startingBalance = balanceDoc.data().amount || 0;
      }
    } catch (e) {
      console.error("Error fetching starting balance:", e);
    }

    const categoryTotals: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'inactive') return; // Skip inactive records

      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (!dateStr) return;

      const date = dayjs(dateStr);
      const isFuture = date.isAfter(now, 'day');

      let rawAmount = data[sanitizeKey("Amount")] || data["Amount"] || "0";
      if (typeof rawAmount === "string") {
        rawAmount = rawAmount.replace(/,/g, ".");
      }
      const amount = Math.abs(parseFloat(rawAmount));
      if (isNaN(amount) || amount === 0) return; // Skip invalid or zero amount records

      const isIncome = data["Type"] === "Income";
      const category = autoCategorize(data["Description"] || "", data["Category"]);

      // Total balance (historical - includes everything that is not future and not inactive)
      if (!isFuture) {
        if (isIncome) totalBalance += amount;
        else totalBalance -= amount;
      }

      // Monthly logic
      if (date.month() === targetMonth && date.year() === targetYear) {
        // Add to full transaction list for reports
        monthlyTransactionsList.push({
          id: doc.id,
          date: dateStr,
          description: data["Description"] || "No Description",
          category: category,
          amount: amount,
          type: data["Type"],
          paymentMethod: data["Payment Method"],
          isFuture
        });

        if (isIncome) {
          monthlyIncomeWithFuture += amount;
          monthlyIncomeItems.push({
            date: dateStr,
            description: data["Description"] || "No Description",
            amount,
            isFuture
          });
          if (!isFuture) {
            monthlyIncome += amount;
          }
        }
      }

      // Standard stats logic (skip future)
      if (isFuture) return;

      // Yearly totals
      if (date.year() === targetYear) {
        if (isIncome) yearlyIncome += amount;
        else yearlyExpense += amount;
      }

      // Monthly totals
      if (date.month() === targetMonth && date.year() === targetYear) {
        if (!isIncome) {
          monthlyTransactions++;
          monthlyAmount += amount;
          if (amount > maxExpense) maxExpense = amount;
          
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }
    });

    // Add starting balance to total balance calculation if needed
    // Actually, Total Balance should probably be Starting Balance + all transactions since that starting point
    // But for now, let's treat Total Balance as a running sum of everything in DB.
    
    // Sort income items by date
    monthlyIncomeItems.sort((a, b) => a.date.localeCompare(b.date));
    monthlyTransactionsList.sort((a, b) => a.date.localeCompare(b.date));

    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || "None";

    const sortedCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .map(([name, value]) => ({ name, value }));

    return {
      monthlyTransactions,
      monthlyAmount,
      monthlyIncome,
      monthlyIncomeWithFuture,
      monthlyIncomeItems,
      monthlyTransactionsList,
      maxExpense,
      yearlyIncome,
      yearlyExpense,
      topCategory,
      sortedCategories,
      targetMonth,
      targetYear,
      startingBalance,
      currentBalance: totalBalance,
      growth: { total: 10, amount: 5 }
    };
  } catch (error) {
    console.error("Error fetching expense stats:", error);
    return {
      monthlyTransactions: 0, monthlyAmount: 0, monthlyIncome: 0, monthlyIncomeWithFuture: 0,
      maxExpense: 0, yearlyIncome: 0, yearlyExpense: 0,
      topCategory: "None", targetMonth: 0, targetYear: 2026,
      startingBalance: 0, currentBalance: 0,
      growth: { total: 0, amount: 0 }
    };
  }
}

export async function getClearanceTimelineData(year?: number) {
  try {
    const snapshot = await getDocs(collection(db, "expenses"));
    const targetYear = year || dayjs().year();
    const incomeMonthly: Record<string, number> = {};
    const expenseMonthly: Record<string, number> = {};
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach(m => { incomeMonthly[m] = 0; expenseMonthly[m] = 0; });

    const now = dayjs();
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'inactive') return;

      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (dateStr) {
        const date = dayjs(dateStr);
        // Skip future dates for stats
        if (date.isAfter(now, 'day')) return;

        if (date.year() === targetYear) {
          const month = months[date.month()];
          let rawAmount = data[sanitizeKey("Amount")] || data["Amount"] || "0";
          if (typeof rawAmount === "string") {
            rawAmount = rawAmount.replace(/,/g, ".");
          }
          const amount = Math.abs(parseFloat(rawAmount));
          if (isNaN(amount) || amount === 0) return;

          if (data["Type"] === "Income") incomeMonthly[month] += amount;
          else expenseMonthly[month] += amount;
        }
      }
    });

    return {
      income: months.map(m => ({ x: m, y: parseFloat(incomeMonthly[m].toFixed(2)) })),
      expense: months.map(m => ({ x: m, y: parseFloat(expenseMonthly[m].toFixed(2)) }))
    };
  } catch (error) {
    console.error("Error fetching timeline data:", error);
    return { income: [], expense: [] };
  }
}

export async function getWeeksProfitData(month?: number, year?: number) {
  try {
    const snapshot = await getDocs(collection(db, "expenses"));
    const now = dayjs();
    const targetMonth = month !== undefined ? month : now.month();
    const targetYear = year !== undefined ? year : now.year();
    const categoryTotals: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'inactive') return;

      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (!dateStr) return;

      const date = dayjs(dateStr);
      // Skip future dates for stats
      if (date.isAfter(now, 'day')) return;

      if (date.month() === targetMonth && date.year() === targetYear) {
        if (data["Type"] !== "Income") {
          const category = autoCategorize(data["Description"] || "", data["Category"]);
          let rawAmount = data[sanitizeKey("Amount")] || data["Amount"] || "0";
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

    return {
      sales: topCategories.map(([name, value]) => ({ x: name, y: parseFloat(value.toFixed(2)) })),
      revenue: topCategories.map(() => ({ x: "", y: 0 })),
    };
  } catch (error) {
    console.error("Error fetching category data:", error);
    return { sales: [], revenue: [] };
  }
}

export async function getPaymentsOverviewData(year?: number) {
  return getClearanceTimelineData(year);
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
  return {
    total_visitors: 0,
    performance: 0,
    chart: [],
  };
}

export async function getVisitorsAnalyticsData() {
  return [];
}

export async function getCostsPerInteractionData() {
  return {
    avg_cost: 0,
    growth: 0,
    chart: [],
  };
}