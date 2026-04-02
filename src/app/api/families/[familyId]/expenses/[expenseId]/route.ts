import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

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

    await getAdminDb().collection("families").doc(familyId).collection("expenses").doc(expenseId).set(data, { merge: true });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update expense." }, { status: 500 });
  }
}
