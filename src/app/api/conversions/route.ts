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

export async function POST(req: NextRequest) {
  try {
    const uid = await verifyUser(req);
    const body = await req.json();
    const record = (body?.record || {}) as Record<string, unknown>;

    const payload = {
      ...record,
      userId: uid,
      createdAt: new Date().toISOString(),
    };

    const ref = await getAdminDb().collection("pdf_conversions").add(payload);
    return NextResponse.json({ id: ref.id }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to save conversion." }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const uid = await verifyUser(req);

    const snapshot = await getAdminDb()
      .collection("pdf_conversions")
      .where("userId", "==", uid)
      .get();

    const records: Array<{ id: string } & Record<string, unknown>> = snapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...(doc.data() as Record<string, unknown>),
      }))
      .sort((a, b) => {
        const aT = new Date(String((a as Record<string, unknown>)["createdAt"] ?? 0)).getTime();
        const bT = new Date(String((b as Record<string, unknown>)["createdAt"] ?? 0)).getTime();
        return bT - aT;
      });

    return NextResponse.json({ records });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to load conversions." }, { status: 500 });
  }
}
