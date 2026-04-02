import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

async function verifyUser(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");
  const decoded = await getAdminAuth().verifyIdToken(token);
  return decoded.uid;
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const uid = await verifyUser(req);
    const { id } = await params;

    const ref = getAdminDb().collection("pdf_conversions").doc(id);
    const snap = await ref.get();
    if (!snap.exists) {
      return NextResponse.json({ error: "Conversion not found." }, { status: 404 });
    }

    const data = snap.data() as { userId?: string };
    if (data.userId !== uid) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await ref.delete();
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete conversion." }, { status: 500 });
  }
}
