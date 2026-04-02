import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

async function verifyAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

  const decoded = await getAdminAuth().verifyIdToken(token);
  const db = getAdminDb();
  let adminSnap = await db.collection("system_users").doc(decoded.uid).get();

  if (!adminSnap.exists) {
    const byUid = await db.collection("system_users").where("uid", "==", decoded.uid).limit(1).get();
    if (!byUid.empty) {
      adminSnap = byUid.docs[0];
    }
  }

  if (!adminSnap.exists && decoded.email) {
    const byLoginEmail = await db
      .collection("system_users")
      .where("loginEmail", "==", decoded.email)
      .limit(1)
      .get();

    if (!byLoginEmail.empty) {
      adminSnap = byLoginEmail.docs[0];
    }
  }

  if (!adminSnap.exists && decoded.email) {
    const byEmail = await db
      .collection("system_users")
      .where("email", "==", decoded.email)
      .limit(1)
      .get();

    if (!byEmail.empty) {
      adminSnap = byEmail.docs[0];
    }
  }

  if (!adminSnap.exists) throw new Error("Admin profile not found");

  const adminProfile = adminSnap.data() as { families?: Record<string, string> };
  const families = adminProfile?.families || {};
  const adminFamilyIds = Object.entries(families)
    .filter(([, role]) => role === "admin")
    .map(([fid]) => fid);

  if (adminFamilyIds.length === 0) throw new Error("Admin access required");
  return { uid: decoded.uid, adminFamilyIds };
}

// GET /api/admin/families — list families the admin manages
export async function GET(req: NextRequest) {
  try {
    const { adminFamilyIds } = await verifyAdmin(req);
    const db = getAdminDb();

    const familiesSnap = await db.collection("families").get();
    const results = await Promise.all(
      familiesSnap.docs.map(async (famDoc) => {
        const fid = famDoc.id;
        const membersSnap = await db
          .collection("families")
          .doc(fid)
          .collection("members")
          .get();

        const members = await Promise.all(
          membersSnap.docs.map(async (m) => {
            const memberData = m.data() as Record<string, any>;
            const memberUid = (memberData.uid as string | undefined) || m.id;

            let userSnap = await db.collection("system_users").doc(memberUid).get();
            if (!userSnap.exists) {
              const byUid = await db
                .collection("system_users")
                .where("uid", "==", memberUid)
                .limit(1)
                .get();
              if (!byUid.empty) userSnap = byUid.docs[0];
            }

            const userData = (userSnap.exists ? userSnap.data() : {}) as Record<string, any>;
            return {
              uid: memberUid,
              role: (memberData.role as string) || "member",
              fullName: (userData.fullName as string) || "",
              username: (userData.username as string) || "",
              loginEmail: (userData.loginEmail as string) || (userData.email as string) || "",
            };
          })
        );

        const data = famDoc.data() || {};
        return {
          id: fid,
          name: data.name || fid,
          status: (data.status as string) || "active",
          memberCount: members.length,
          members,
          createdAt: data.createdAt || null,
          manageable: adminFamilyIds.includes(fid),
        };
      })
    );

    results.sort((a, b) => String(a.name).localeCompare(String(b.name)));

    return NextResponse.json({ families: results });
  } catch (error: any) {
    const msg = error?.message || "Unauthorized";
    const status = msg.includes("Admin") || msg.includes("token") ? 403 : 500;
    return NextResponse.json({ error: msg }, { status });
  }
}

// PATCH /api/admin/families — activate or deactivate a family
// body: { familyId: string, status: "active" | "inactive" }
export async function PATCH(req: NextRequest) {
  try {
    const { adminFamilyIds } = await verifyAdmin(req);
    const body = await req.json();
    const familyId = String(body?.familyId || "").trim();
    const status = body?.status === "inactive" ? "inactive" : "active";

    if (!familyId) {
      return NextResponse.json({ error: "familyId is required." }, { status: 400 });
    }

    if (!adminFamilyIds.includes(familyId)) {
      return NextResponse.json({ error: "Admin access required for this family." }, { status: 403 });
    }

    await getAdminDb().collection("families").doc(familyId).set(
      { status, updatedAt: new Date().toISOString() },
      { merge: true }
    );

    return NextResponse.json({ success: true, familyId, status });
  } catch (error: any) {
    console.error("PATCH /api/admin/families failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to update family." }, { status: 500 });
  }
}
