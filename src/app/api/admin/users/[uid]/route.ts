import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

async function verifyAdmin(req: NextRequest) {
  const token = getBearerToken(req);
  if (!token) {
    throw new Error("Missing bearer token");
  }

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

  if (!adminSnap.exists) {
    throw new Error("Admin profile not found");
  }

  const adminProfile = adminSnap.data() as { families?: Record<string, string> };
  const families = adminProfile?.families || {};
  const isAdmin = Object.values(families).includes("admin");
  if (!isAdmin) {
    throw new Error("Admin access required");
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdmin(req);
    const { uid } = await params;

    if (!uid) {
      return NextResponse.json({ error: "User UID is required." }, { status: 400 });
    }

    const db = getAdminDb();

    // Remove from all family member sub-collections
    const directDoc = await db.collection("system_users").doc(uid).get();
    let userDocRef = directDoc.exists ? directDoc.ref : null;
    let userData = directDoc.exists ? (directDoc.data() as { families?: Record<string, string> }) : null;

    if (!userDocRef) {
      const byUidSnap = await db.collection("system_users").where("uid", "==", uid).limit(1).get();
      if (!byUidSnap.empty) {
        userDocRef = byUidSnap.docs[0].ref;
        userData = byUidSnap.docs[0].data() as { families?: Record<string, string> };
      }
    }

    if (userData) {
      const data = userData;
      const familyIds = Object.keys(data?.families || {});
      await Promise.all(
        familyIds.map((fid) =>
          db.collection("families").doc(fid).collection("members").doc(uid).delete()
        )
      );
    }

    // Delete system_users document
    if (userDocRef) {
      await userDocRef.delete();
    }

    // Delete Firebase Auth user
    try {
      await getAdminAuth().deleteUser(uid);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") {
        throw err;
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("DELETE /api/admin/users/[uid] failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to delete user." }, { status: 500 });
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ uid: string }> }
) {
  try {
    await verifyAdmin(req);
    const { uid } = await params;

    if (!uid) {
      return NextResponse.json({ error: "User UID is required." }, { status: 400 });
    }

    const body = await req.json();
    const fullName = String(body?.fullName || "").trim();
    const username = String(body?.username || "").trim().toLowerCase();
    const email = String(body?.email || "").trim();
    const userId = String(body?.userId || "").trim();
    const password = String(body?.password || "");
    const status = body?.status === "inactive" ? "inactive" : "active";

    const db = getAdminDb();

    const directDoc = await db.collection("system_users").doc(uid).get();
    let userDocRef = directDoc.exists ? directDoc.ref : null;
    if (!userDocRef) {
      const byUidSnap = await db.collection("system_users").where("uid", "==", uid).limit(1).get();
      if (!byUidSnap.empty) {
        userDocRef = byUidSnap.docs[0].ref;
      }
    }

    const currentDocId = userDocRef?.id || uid;
    const currentUid = uid;

    if (username) {
      const duplicateUsername = await db
        .collection("system_users")
        .where("username", "==", username)
        .limit(5)
        .get();

      const hasConflict = duplicateUsername.docs.some((doc) => {
        const data = doc.data() as { uid?: string };
        const candidateUid = data.uid || doc.id;
        const sameDoc = doc.id === currentDocId;
        const sameUid = candidateUid === currentUid;
        return !sameDoc && !sameUid;
      });

      if (hasConflict) {
        return NextResponse.json({ error: "Username already exists." }, { status: 409 });
      }
    }

    const updatePayload: Record<string, unknown> = {
      status,
      updatedAt: new Date().toISOString(),
    };
    if (fullName) updatePayload.fullName = fullName;
    if (username) updatePayload.username = username;
    if (email) updatePayload.email = email;
    if (userId) updatePayload.userId = userId;

    if (userDocRef) {
      await userDocRef.set(updatePayload, { merge: true });
    } else {
      await db.collection("system_users").doc(uid).set({ ...updatePayload, uid }, { merge: true });
    }

    const authUpdatePayload: { displayName?: string; disabled?: boolean; password?: string } = {
      disabled: status === "inactive",
    };
    if (fullName) authUpdatePayload.displayName = fullName;
    if (password) authUpdatePayload.password = password;

    try {
      await getAdminAuth().updateUser(uid, authUpdatePayload);
    } catch (err: any) {
      if (err?.code !== "auth/user-not-found") {
        throw err;
      }
      if (password) {
        return NextResponse.json(
          { error: "This user has no Auth account yet, so password cannot be reset." },
          { status: 400 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error("PATCH /api/admin/users/[uid] failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to update user." }, { status: 500 });
  }
}
