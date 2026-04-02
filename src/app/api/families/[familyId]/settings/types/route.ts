import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

async function getConfigRef(familyId: string) {
  return getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const configRef = await getConfigRef(familyId);
    const snap = await configRef.get();
    const config = snap.exists ? (snap.data() as Record<string, unknown>) : {};

    const incomeConfigs = Array.isArray(config.incomeConfigs) ? config.incomeConfigs : [];
    const storedIncomeTypes = Array.isArray(config.incomeTypes) ? config.incomeTypes : [];
    const incomeTypes = storedIncomeTypes.length > 0
      ? storedIncomeTypes
      : incomeConfigs.map((c: { name?: unknown }) => String(c.name || "").trim()).filter(Boolean);

    return NextResponse.json({
      expenseTypes: Array.isArray(config.expenseTypes) ? config.expenseTypes : [],
      incomeTypes,
    });
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
    await verifyFamilyAccess(req, familyId, false);

    const body = await req.json();
    const kind = String(body?.kind || "").trim();
    const types = Array.isArray(body?.types)
      ? body.types.map((t: unknown) => String(t).trim()).filter(Boolean)
      : null;

    if (!types || (kind !== "expense" && kind !== "income")) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const fieldName = kind === "expense" ? "expenseTypes" : "incomeTypes";
    const configRef = await getConfigRef(familyId);
    await configRef.set(
      {
        [fieldName]: types,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save types." }, { status: 500 });
  }
}
