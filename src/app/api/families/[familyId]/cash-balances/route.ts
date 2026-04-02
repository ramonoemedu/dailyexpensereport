import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

type CashBalance = {
  id: string;
  year: number;
  month: number;
  amount: number;
  amountKHR: number;
};

type FamilyConfig = {
  cashBalances?: Array<{
    year: number;
    month: number;
    amount: number;
    amountKHR?: number;
  }>;
  [key: string]: unknown;
};

function parseId(id: string) {
  const parts = id.split("_");
  if (parts.length !== 4 || parts[0] !== "cash" || parts[1] !== "balance") {
    return null;
  }

  const year = Number(parts[2]);
  const month = Number(parts[3]);
  if (!Number.isFinite(year) || !Number.isFinite(month)) {
    return null;
  }

  return { year, month };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const configRef = getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
    const configSnap = await configRef.get();
    if (configSnap.exists) {
      const config = configSnap.data() as FamilyConfig;
      const cashBalances = Array.isArray(config.cashBalances) ? config.cashBalances : [];

      if (cashBalances.length > 0) {
        const balances: CashBalance[] = cashBalances
          .map((b) => ({
            id: `cash_balance_${Number(b.year)}_${Number(b.month)}`,
            year: Number(b.year),
            month: Number(b.month),
            amount: Number(b.amount || 0),
            amountKHR: Number(b.amountKHR || 0),
          }))
          .filter((b) => Number.isFinite(b.year) && Number.isFinite(b.month))
          .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

        return NextResponse.json({ balances });
      }

      // Backward compatibility: old shape stored month cash balances as flat fields:
      // cash_balance_YYYY_M (USD), cash_balance_khr_YYYY_M (KHR).
      const legacyMap = new Map<string, { year: number; month: number; amount: number; amountKHR: number }>();

      for (const [key, value] of Object.entries(config)) {
        const usdMatch = key.match(/^cash_balance_(\d{4})_(\d{1,2})$/);
        const khrMatch = key.match(/^cash_balance_khr_(\d{4})_(\d{1,2})$/);

        if (!usdMatch && !khrMatch) continue;

        const year = Number((usdMatch || khrMatch)?.[1]);
        const month = Number((usdMatch || khrMatch)?.[2]);
        const amount =
          typeof value === "number"
            ? Number(value)
            : Number(((value as { amount?: unknown; value?: unknown })?.amount ?? (value as { value?: unknown })?.value ?? 0));

        if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount)) {
          continue;
        }

        const id = `${year}_${month}`;
        const curr = legacyMap.get(id) || { year, month, amount: 0, amountKHR: 0 };
        if (usdMatch) curr.amount = amount;
        if (khrMatch) curr.amountKHR = amount;
        legacyMap.set(id, curr);
      }

      if (legacyMap.size > 0) {
        const migratedCashBalances = Array.from(legacyMap.values());

        // Migrate: write array format and delete all legacy flat fields atomically
        const deleteFields: Record<string, FieldValue> = {};
        for (const key of Object.keys(config)) {
          if (/^cash_balance_/.test(key)) {
            deleteFields[key] = FieldValue.delete();
          }
        }
        await configRef.set(
          { ...deleteFields, cashBalances: migratedCashBalances, updatedAt: new Date().toISOString() },
          { merge: true }
        );

        const balances: CashBalance[] = migratedCashBalances
          .map((b) => ({
            id: `cash_balance_${b.year}_${b.month}`,
            year: b.year,
            month: b.month,
            amount: Number(b.amount || 0),
            amountKHR: Number(b.amountKHR || 0),
          }))
          .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

        return NextResponse.json({ balances });
      }
    }

    return NextResponse.json({ balances: [] as CashBalance[] });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 403 });
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, true);

    const body = await req.json();
    const year = Number(body?.year);
    const month = Number(body?.month);
    const amount = Number(body?.amount || 0);
    const amountKHR = Number(body?.amountKHR || 0);

    if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount) || !Number.isFinite(amountKHR)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const configRef = getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
    const configSnap = await configRef.get();
    const config = (configSnap.exists ? configSnap.data() : {}) as FamilyConfig;
    const existing = Array.isArray(config.cashBalances) ? config.cashBalances : [];

    const idx = existing.findIndex(
      (b) => Number(b.year) === year && Number(b.month) === month
    );
    const nextItem = { year, month, amount, amountKHR };
    if (idx >= 0) {
      existing[idx] = nextItem;
    } else {
      existing.push(nextItem);
    }

    await configRef.set(
      {
        ...config,
        cashBalances: existing,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save cash balance." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, true);

    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id.startsWith("cash_balance_")) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const parsed = parseId(id);
    if (!parsed) {
      return NextResponse.json({ error: "Invalid id." }, { status: 400 });
    }

    const configRef = getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
    const configSnap = await configRef.get();
    const config = (configSnap.exists ? configSnap.data() : {}) as FamilyConfig;
    const existing = Array.isArray(config.cashBalances) ? config.cashBalances : [];
    const filtered = existing.filter(
      (b) => !(Number(b.year) === parsed.year && Number(b.month) === parsed.month)
    );

    await configRef.set(
      {
        ...config,
        cashBalances: filtered,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete cash balance." }, { status: 500 });
  }
}
