import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

type IncomeConfig = {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  status: "active" | "inactive";
};

async function readConfig(familyId: string) {
  const ref = getAdminDb().collection("families").doc(familyId).collection("settings").doc("config");
  const snap = await ref.get();
  const config = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const raw = Array.isArray(config.incomeConfigs) ? config.incomeConfigs : [];

  const items = raw
    .map((x) => {
      const i = x as Partial<IncomeConfig>;
      return {
        id: String(i.id || "").trim(),
        name: String(i.name || "").trim(),
        amount: Number(i.amount || 0),
        dayOfMonth: Number(i.dayOfMonth || 1),
        status: i.status === "inactive" ? "inactive" : "active",
      } as IncomeConfig;
    })
    .filter((i) => i.id && i.name && Number.isFinite(i.amount) && Number.isFinite(i.dayOfMonth));

  return { ref, config, items };
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const { items } = await readConfig(familyId);
    return NextResponse.json({ configs: items });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Unauthorized" }, { status: 403 });
  }
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const body = await req.json();
    const name = String(body?.name || "").trim();
    const amount = Number(body?.amount);
    const dayOfMonth = Number(body?.dayOfMonth);
    const status = body?.status === "inactive" ? "inactive" : "active";

    if (!name || !Number.isFinite(amount) || !Number.isFinite(dayOfMonth)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { ref, config, items } = await readConfig(familyId);
    if (items.some((i) => i.name.toLowerCase() === name.toLowerCase())) {
      return NextResponse.json({ error: "Income source already exists." }, { status: 409 });
    }

    const nextItem: IncomeConfig = {
      id: crypto.randomUUID(),
      name,
      amount,
      dayOfMonth,
      status,
    };

    const nextItems = [...items, nextItem];
    await ref.set({ ...config, incomeConfigs: nextItems, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ config: nextItem }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to create income source." }, { status: 500 });
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
    const id = String(body?.id || "").trim();
    const name = String(body?.name || "").trim();
    const amount = Number(body?.amount);
    const dayOfMonth = Number(body?.dayOfMonth);
    const status = body?.status === "inactive" ? "inactive" : "active";

    if (!id || !name || !Number.isFinite(amount) || !Number.isFinite(dayOfMonth)) {
      return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
    }

    const { ref, config, items } = await readConfig(familyId);
    const idx = items.findIndex((i) => i.id === id);
    if (idx < 0) {
      return NextResponse.json({ error: "Income source not found." }, { status: 404 });
    }

    items[idx] = { id, name, amount, dayOfMonth, status };
    await ref.set({ ...config, incomeConfigs: items, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to update income source." }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId, false);

    const { searchParams } = new URL(req.url);
    const id = String(searchParams.get("id") || "").trim();
    if (!id) {
      return NextResponse.json({ error: "Missing id query param." }, { status: 400 });
    }

    const { ref, config, items } = await readConfig(familyId);
    const filtered = items.filter((i) => i.id !== id);
    await ref.set({ ...config, incomeConfigs: filtered, updatedAt: new Date().toISOString() }, { merge: true });

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to delete income source." }, { status: 500 });
  }
}
