import { NextRequest, NextResponse } from "next/server";
import dayjs from "dayjs";
import { getAdminDb } from "@/lib/firebaseAdmin";
import { verifyFamilyAccess } from "@/lib/verifyFamilyAccess";

type IncomeConfig = {
  id: string;
  name: string;
  amount: number;
  dayOfMonth: number;
  status: "active" | "inactive";
};

async function verifyFamilyAdmin(req: NextRequest, familyId: string) {
  await verifyFamilyAccess(req, familyId, true);
}

async function readIncomeConfigs(familyId: string) {
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
    .filter((i) => i.id && i.name);

  return items;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAdmin(req, familyId);

    const body = await req.json();
    const processType = body?.processType === "yearly" ? "yearly" : "monthly";
    const processDate = dayjs(String(body?.processDate || ""));

    if (!processDate.isValid()) {
      return NextResponse.json({ error: "Invalid process date." }, { status: 400 });
    }

    const configs = (await readIncomeConfigs(familyId)).filter((c) => c.status === "active");
    if (configs.length === 0) {
      return NextResponse.json({ createdCount: 0, skippedCount: 0 });
    }

    const expensesCol = getAdminDb().collection("families").doc(familyId).collection("expenses");
    const monthsToProcess = processType === "yearly" ? Array.from({ length: 12 }, (_, i) => i) : [processDate.month()];

    let createdCount = 0;
    let skippedCount = 0;

    for (const monthIdx of monthsToProcess) {
      const target = processDate.month(monthIdx);

      for (const config of configs) {
        const dateStr = target.date(config.dayOfMonth).format("YYYY-MM-DD");

        const dup = await expensesCol
          .where("Date", "==", dateStr)
          .where("Category", "==", config.name)
          .where("Type", "==", "Income")
          .limit(1)
          .get();

        if (!dup.empty) {
          skippedCount += 1;
          continue;
        }

        await expensesCol.add({
          Date: dateStr,
          Type: "Income",
          Category: config.name,
          Description: `Auto-Generated: ${config.name}`,
          Amount: config.amount,
          "Payment Method": "Cash",
          status: "active",
          createdAt: new Date().toISOString(),
        });

        createdCount += 1;
      }
    }

    return NextResponse.json({ createdCount, skippedCount });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Failed to process incomes." }, { status: 500 });
  }
}
