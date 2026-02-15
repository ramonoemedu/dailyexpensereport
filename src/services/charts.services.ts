import { db } from "@/lib/firebase";
import { collection, getDocs, query, orderBy } from "firebase/firestore";
import { sanitizeKey } from "@/utils/KeySanitizer";

function autoCategorize(description: string, existingCategory: string): string {
  if (existingCategory && existingCategory !== "Uncategorized") return existingCategory;
  
  const desc = description.toLowerCase();
  if (desc.includes("café") || desc.includes("lunch") || desc.includes("dinner") || desc.includes("food") || desc.includes("restaurant") || desc.includes("drink") || desc.includes("matcha")) return "Food & Dining";
  if (desc.includes("gasoline") || desc.includes("taxi") || desc.includes("grab") || desc.includes("car") || desc.includes("hometown")) return "Transportation";
  if (desc.includes("electricity") || desc.includes("water") || desc.includes("internet") || desc.includes("phone") || desc.includes("top up")) return "Utilities";
  if (desc.includes("salary") || desc.includes("income") || desc.includes("bonus")) return "Salary/Income";
  if (desc.includes("nail") || desc.includes("cream") || desc.includes("skincare") || desc.includes("body") || desc.includes("hair")) return "Personal Care";
  if (desc.includes("loan") || desc.includes("aeon") || desc.includes("interest")) return "Loans & Debt";
  if (desc.includes("mak") || desc.includes("pa") || desc.includes("pha") || desc.includes("hea") || desc.includes("send to")) return "Family Support";
  
  return "General/Other";
}

export async function getClearPortStats(month?: number, year?: number) {
  try {
    const snapshot = await getDocs(collection(db, "expenses"));
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();
    
    let monthlyTransactions = 0;
    let monthlyAmount = 0;
    let monthlyIncome = 0;
    let monthlyIncomeWithFuture = 0;
    let monthlyIncomeItems: any[] = [];
    let maxExpense = 0;
    
    let yearlyIncome = 0;
    let yearlyExpense = 0;

    const categoryTotals: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = new Date(data[sanitizeKey("Date")] || data["Date"]);
      const isFuture = date > now;

      const amount = Math.abs(parseFloat(data[sanitizeKey("Amount")] || data["Amount"] || "0"));
      const isIncome = data["Type"] === "Income";
      const category = autoCategorize(data["Description"] || "", data["Category"]);

      // Calculate Monthly Income with Future (Always include)
      if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
        if (isIncome) {
          monthlyIncomeWithFuture += amount;
          monthlyIncomeItems.push({
            date: data[sanitizeKey("Date")] || data["Date"],
            description: data["Description"] || "No Description",
            amount,
            isFuture
          });
          if (!isFuture) {
            monthlyIncome += amount;
          }
        }
      }

      // Skip future dates for standard stats
      if (isFuture) return;

      // Yearly totals
      if (date.getFullYear() === targetYear) {
        if (isIncome) yearlyIncome += amount;
        else yearlyExpense += amount;
      }

      // Monthly totals
      if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
        if (!isIncome) {
          monthlyTransactions++;
          monthlyAmount += amount;
          if (amount > maxExpense) maxExpense = amount;
          
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }
    });

    // Sort income items by date
    monthlyIncomeItems.sort((a, b) => a.date.localeCompare(b.date));

    const topCategory = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || "None";

    return {
      monthlyTransactions,
      monthlyAmount,
      monthlyIncome,
      monthlyIncomeWithFuture,
      monthlyIncomeItems,
      maxExpense,
      yearlyIncome,
      yearlyExpense,
      topCategory,
      targetMonth,
      targetYear,
      growth: { total: 10, amount: 5 }
    };
  } catch (error) {
    console.error("Error fetching expense stats:", error);
    return {
      monthlyTransactions: 0, monthlyAmount: 0, monthlyIncome: 0, monthlyIncomeWithFuture: 0,
      maxExpense: 0, yearlyIncome: 0, yearlyExpense: 0,
      topCategory: "None", targetMonth: 0, targetYear: 2026,
      growth: { total: 0, amount: 0 }
    };
  }
}

export async function getClearanceTimelineData(year?: number) {
  try {
    const snapshot = await getDocs(collection(db, "expenses"));
    const targetYear = year || new Date().getFullYear();
    const incomeMonthly: Record<string, number> = {};
    const expenseMonthly: Record<string, number> = {};
    
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    months.forEach(m => { incomeMonthly[m] = 0; expenseMonthly[m] = 0; });

    const now = new Date();
    now.setHours(23, 59, 59, 999);
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const dateStr = data[sanitizeKey("Date")] || data["Date"];
      if (dateStr) {
        const date = new Date(dateStr);
        // Skip future dates for stats
        if (date > now) return;

        if (date.getFullYear() === targetYear) {
          const month = months[date.getMonth()];
          const amount = Math.abs(parseFloat(data[sanitizeKey("Amount")] || data["Amount"] || "0"));
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
    const now = new Date();
    now.setHours(23, 59, 59, 999);
    const targetMonth = month !== undefined ? month : now.getMonth();
    const targetYear = year !== undefined ? year : now.getFullYear();
    const categoryTotals: Record<string, number> = {};

    snapshot.docs.forEach(doc => {
      const data = doc.data();
      const date = new Date(data[sanitizeKey("Date")] || data["Date"]);
      // Skip future dates for stats
      if (date > now) return;

      if (date.getMonth() === targetMonth && date.getFullYear() === targetYear) {
        if (data["Type"] !== "Income") {
          const category = autoCategorize(data["Description"] || "", data["Category"]);
          const amount = Math.abs(parseFloat(data[sanitizeKey("Amount")] || data["Amount"] || "0"));
          categoryTotals[category] = (categoryTotals[category] || 0) + amount;
        }
      }
    });

    const topCategories = Object.entries(categoryTotals)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5);

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