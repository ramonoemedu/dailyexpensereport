import { NextRequest, NextResponse } from "next/server";
import { FieldValue } from "firebase-admin/firestore";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

type BalanceItem = {
  bankId: string;
  year: number;
  month: number;
  amount: number;
};

async function readBalancesFromConfig(familyId: string) {
  const configRef = getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
  const configSnap = await configRef.get();

  if (!configSnap.exists) {
    return { configRef, config: {} as Record<string, unknown>, balances: [] as BalanceItem[] };
  }

  const config = configSnap.data() as Record<string, unknown>;
  const rawBalances = Array.isArray(config.balances) ? config.balances : [];

  const balancesFromArray = rawBalances
    .map((b) => {
      const item = b as Partial<BalanceItem>;
      return {
        bankId: String(item.bankId || "").trim(),
        year: Number(item.year),
        month: Number(item.month),
        amount: Number(item.amount || 0),
      };
    })
    .filter((b) => b.bankId && Number.isFinite(b.year) && Number.isFinite(b.month) && Number.isFinite(b.amount));

  if (balancesFromArray.length > 0) {
    return { configRef, config, balances: balancesFromArray };
  }

  // Backward compatibility: old shape stored month balances as flat fields like:
  // balance_chip-mong_2026_0 or balance_2026_0.
  const legacyMap = new Map<string, BalanceItem>();
  for (const [key, value] of Object.entries(config)) {
    let bankId = "";
    let year = Number.NaN;
    let month = Number.NaN;

    const withBank = key.match(/^balance_([^_]+)_(\d{4})_(\d{1,2})$/);
    const noBank = key.match(/^balance_(\d{4})_(\d{1,2})$/);

    if (withBank) {
      bankId = String(withBank[1] || "").trim();
      year = Number(withBank[2]);
      month = Number(withBank[3]);
    } else if (noBank) {
      bankId = "chip-mong";
      year = Number(noBank[1]);
      month = Number(noBank[2]);
    } else {
      continue;
    }

    const amount =
      typeof value === "number"
        ? Number(value)
        : Number(((value as { amount?: unknown; value?: unknown })?.amount ?? (value as { value?: unknown })?.value ?? 0));

    if (!bankId || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount)) {
      continue;
    }

    const compositeId = `${bankId}_${year}_${month}`;
    legacyMap.set(compositeId, { bankId, year, month, amount });
  }

  const legacyBalances = Array.from(legacyMap.values());

  if (legacyBalances.length > 0) {
    // Migrate: write array format and delete all legacy flat fields atomically
    const deleteFields: Record<string, FieldValue> = {};
    for (const key of Object.keys(config)) {
      if (/^balance_/.test(key)) {
        deleteFields[key] = FieldValue.delete();
      }
    }
    await configRef.set(
      { ...deleteFields, balances: legacyBalances, updatedAt: new Date().toISOString() },
      { merge: true }
    );
  }

  return { configRef, config, balances: legacyBalances };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const { balances } = await readBalancesFromConfig(familyId);
    const items = balances
      .map((b) => ({
        id: `${b.bankId}_${b.year}_${b.month}`,
        ...b,
      }))
      .sort((a, b) => (b.year * 12 + b.month) - (a.year * 12 + a.month));

    return NextResponse.json({ balances: items });
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
    const bankId = String(body?.bankId || "").trim();
    const year = Number(body?.year);
    const month = Number(body?.month);
    const amount = Number(body?.amount);

    if (!bankId || !Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(amount)) {
      return NextResponse.json({ error: "Invalid balance payload." }, { status: 400 });
    }

    const { configRef, config, balances } = await readBalancesFromConfig(familyId);
    const idx = balances.findIndex((b) => b.bankId === bankId && b.year === year && b.month === month);

    if (idx >= 0) {
      balances[idx] = { bankId, year, month, amount };
    } else {
      balances.push({ bankId, year, month, amount });
    }

    await configRef.set({ ...config, balances, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save balance." }, { status: 500 });
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
    const bankId = String(searchParams.get("bankId") || "").trim();
    const year = Number(searchParams.get("year"));
    const month = Number(searchParams.get("month"));

    if (!bankId || !Number.isFinite(year) || !Number.isFinite(month)) {
      return NextResponse.json({ error: "Missing bankId/year/month query params." }, { status: 400 });
    }

    const { configRef, config, balances } = await readBalancesFromConfig(familyId);
    const filtered = balances.filter((b) => !(b.bankId === bankId && b.year === year && b.month === month));

    await configRef.set({ ...config, balances: filtered, updatedAt: new Date().toISOString() }, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete balance." }, { status: 500 });
  }
}
