import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";
import { rebuildMonthReport, rebuildBankReport } from "@/lib/dashboardReport";
import { BANKS } from "@/utils/bankConstants";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string; expenseId: string }> }
) {
  try {
    const { familyId, expenseId } = await params;
    await verifyFamilyAccess(req, familyId);

    const body = await req.json();
    const data = (body?.data || {}) as Record<string, unknown>;

    if (!expenseId) {
      return NextResponse.json({ error: "Missing expense id." }, { status: 400 });
    }

    const db = getAdminDb();
    const expenseRef = db.collection("families").doc(familyId).collection("expenses").doc(expenseId);

    // Read old doc before update so we know which months to rebuild
    const oldSnap = await expenseRef.get();
    const oldData = oldSnap.exists ? (oldSnap.data() as Record<string, any>) : null;

    await expenseRef.set(data, { merge: true });

    // Rebuild any months affected (handles date changes across months/years)
    const monthKeys = new Set<string>();
    const addMonth = (dateStr: string) => {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) monthKeys.add(`${d.getFullYear()}:${d.getMonth()}`);
    };
    const newDate = String(data.Date || '');
    const oldDate = String(oldData?.Date || '');
    if (newDate) addMonth(newDate);
    if (oldDate && oldDate !== newDate) addMonth(oldDate);

    for (const key of monthKeys) {
      const [y, m] = key.split(':').map(Number);
      rebuildMonthReport(familyId, y, m).catch(() => {});
      BANKS.forEach(b => rebuildBankReport(familyId, b.id, y, m).catch(() => {}));
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update expense." }, { status: 500 });
  }
}
