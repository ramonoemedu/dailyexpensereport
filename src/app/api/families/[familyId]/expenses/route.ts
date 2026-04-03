import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { unsanitizeKey } from "@/utils/KeySanitizer";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";
import { rebuildMonthReport, rebuildBankReport } from "@/lib/dashboardReport";
import { BANKS } from "@/utils/bankConstants";

function toInt(value: string | null, fallback: number) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function expandPaymentFilters(filters: string[]) {
  return filters.flatMap((f) => {
    const lower = f.toLowerCase();
    if (lower.includes("chip mong")) {
      return [lower, "from chipmong bank to acaleda", "chip mong bank"];
    }
    if (lower.includes("acleda")) {
      return [lower, "acleda bank", "from chipmong bank to acaleda"];
    }
    return [lower];
  });
}

function mapExpenseToUiRow(id: string, raw: Record<string, any>) {
  const mapped: Record<string, any> = { id };
  for (const key of Object.keys(raw)) {
    const uiKey = unsanitizeKey(key);
    mapped[uiKey] = raw[key];
  }
  if (raw.Amount !== undefined) {
    mapped["Amount (Income/Expense)"] = raw.Amount;
    mapped["Amount"] = raw.Amount;
  }
  if (!mapped["Type"]) mapped["Type"] = "Expense";
  return mapped;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    const db = getAdminDb();
    const url = new URL(req.url);
    const page = Math.max(1, toInt(url.searchParams.get("page"), 1));
    const pageSize = Math.min(100, Math.max(1, toInt(url.searchParams.get("pageSize"), 20)));

    const month = toInt(url.searchParams.get("month"), new Date().getMonth());
    const year = toInt(url.searchParams.get("year"), new Date().getFullYear());
    const date = url.searchParams.get("date") || null;
    const searchText = (url.searchParams.get("searchText") || "").toLowerCase().trim();
    const typeFilter = url.searchParams.get("typeFilter") || "All";
    const statusFilter = (url.searchParams.get("statusFilter") || "active") as "active" | "inactive" | "all";
    const paymentMethodsRaw = (url.searchParams.get("paymentMethods") || "").trim();
    const paymentMethods = paymentMethodsRaw
      ? paymentMethodsRaw.split("|").map((x) => x.trim()).filter(Boolean)
      : [];
    const expandedPaymentFilters = expandPaymentFilters(paymentMethods);
    const balanceType = (url.searchParams.get("balanceType") || "bank") as "bank" | "cash";
    const bankId = url.searchParams.get("bankId") || "";

    const monthStart = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const monthEndDate = new Date(year, month + 1, 0);
    const monthEnd = `${year}-${String(month + 1).padStart(2, "0")}-${String(monthEndDate.getDate()).padStart(2, "0")}`;

    let expensesQuery = db
      .collection("families")
      .doc(familyId)
      .collection("expenses")
      .where("Date", ">=", monthStart)
      .where("Date", "<=", monthEnd)
      .orderBy("Date", "desc");

    if (date) {
      expensesQuery = db
        .collection("families")
        .doc(familyId)
        .collection("expenses")
        .where("Date", "==", date)
        .orderBy("Date", "desc");
    }

    const [, snapshot, configSnap] = await Promise.all([
      verifyFamilyAccess(req, familyId),
      expensesQuery.get(),
      db.collection("families").doc(familyId).collection("settings").doc("config").get(),
    ]);

    const rows = snapshot.docs
      .map((doc) => ({ id: doc.id, raw: doc.data() as Record<string, any> }))
      .sort((a, b) => {
        const aDate = String(a.raw.Date || "");
        const bDate = String(b.raw.Date || "");
        if (aDate !== bDate) return bDate.localeCompare(aDate);
        return String(b.raw.createdAt || "").localeCompare(String(a.raw.createdAt || ""));
      });

    const filtered = rows.filter(({ raw }) => {
      const status = (raw.status || "active") as "active" | "inactive";
      if (statusFilter !== "all") {
        if (statusFilter === "active" && status !== "active") return false;
        if (statusFilter === "inactive" && status !== "inactive") return false;
      }

      const rowType = String(raw.Type || raw.type || "Expense");
      if (typeFilter !== "All" && rowType !== typeFilter) return false;

      const methodRaw = String(raw["Payment Method"] || raw["Payment_Method"] || "");
      const method = methodRaw.toLowerCase().trim();
      if (expandedPaymentFilters.length > 0) {
        const pass = expandedPaymentFilters.some(
          (f) => method.includes(f) || f.includes(method)
        );
        if (!pass) return false;
      }

      if (searchText) {
        const haystack = [
          String(raw.Description || ""),
          String(raw["Payment Method"] || raw["Payment_Method"] || ""),
          String(raw.Category || ""),
        ]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(searchText)) return false;
      }

      if (date) {
        const rowDate = String(raw.Date || "");
        if (rowDate !== date) return false;
      }

      return true;
    });

    const totalRows = filtered.length;
    const start = (page - 1) * pageSize;
    const pageRows = filtered.slice(start, start + pageSize).map(({ id, raw }) => mapExpenseToUiRow(id, raw));

    const uniqueDescriptions = Array.from(
      new Set(
        filtered
          .map(({ raw }) => String(raw.Description || "").trim())
          .filter(Boolean)
      )
    ).sort();

    const filteredStats = {
      totalDebit: 0,
      totalCredit: 0,
      totalDebitKHR: 0,
      totalCreditKHR: 0,
    };

    let monthlyIncome = 0;
    let monthlyExpense = 0;

    filtered.forEach(({ raw }) => {
      const amount = Math.abs(Number(raw.Amount || raw.amount || 0));
      const isIncome = String(raw.Type || raw.type || "Expense") === "Income";
      const currency = String(raw.Currency || "USD");

      if (currency === "KHR") {
        if (isIncome) filteredStats.totalDebitKHR += amount;
        else filteredStats.totalCreditKHR += amount;
      } else {
        if (isIncome) {
          filteredStats.totalDebit += amount;
          monthlyIncome += amount;
        } else {
          filteredStats.totalCredit += amount;
          monthlyExpense += amount;
        }
      }
    });

    const config = configSnap.exists ? (configSnap.data() as any) : {};
    const familyBankBalances = Array.isArray(config?.balances) ? config.balances : [];
    const familyCashBalances = Array.isArray(config?.cashBalances) ? config.cashBalances : [];

    const targetTime = year * 12 + month;
    const selectedBalances = balanceType === "cash"
      ? familyCashBalances
      : bankId
        ? familyBankBalances.filter((b: any) => b.bankId === bankId)
        : familyBankBalances;

    const normalizedBalances = selectedBalances
      .map((b: any) => ({
        year: Number(b.year),
        month: Number(b.month),
        amount: Number(b.amount || 0),
      }))
      .filter((b: any) => Number.isFinite(b.year) && Number.isFinite(b.month))
      .sort((a: any, b: any) => (a.year * 12 + a.month) - (b.year * 12 + b.month));

    const anchor = [...normalizedBalances].reverse().find((r: any) => (r.year * 12 + r.month) <= targetTime);
    const startingBalance = anchor ? Number(anchor.amount || 0) : 0;

    const stats = {
      weeklyIncome: 0,
      weeklyExpense: 0,
      monthlyIncome,
      monthlyExpense,
      totalIncome: monthlyIncome,
      totalExpense: monthlyExpense,
      startingBalance,
      currentBalance: startingBalance + monthlyIncome - monthlyExpense,
      startingBalanceKHR: 0,
      monthlyIncomeKHR: filteredStats.totalDebitKHR,
      monthlyExpenseKHR: filteredStats.totalCreditKHR,
      currentBalanceKHR: 0 + filteredStats.totalDebitKHR - filteredStats.totalCreditKHR,
    };

    return NextResponse.json({
      rows: pageRows,
      totalRows,
      page,
      pageSize,
      stats,
      filteredStats,
      uniqueDescriptions,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Failed to fetch expenses." },
      { status: 500 }
    );
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

    const payload: Record<string, unknown> = {
      ...data,
      status: data.status || "active",
      createdAt: data.createdAt || new Date().toISOString(),
    };

    const ref = await getAdminDb().collection("families").doc(familyId).collection("expenses").add(payload);

    // Rebuild dashboard + bank reports for the expense's month
    const dateStr = String(data.Date || '');
    if (dateStr) {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear(), m = d.getMonth();
        rebuildMonthReport(familyId, y, m).catch(() => {});
        BANKS.forEach(b => rebuildBankReport(familyId, b.id, y, m).catch(() => {}));
      }
    }

    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create expense." }, { status: 500 });
  }
}
