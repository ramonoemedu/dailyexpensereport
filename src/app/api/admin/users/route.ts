import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type SystemUserDoc = {
  fullName: string;
  username: string;
  userId: string;
  email?: string;
  loginEmail: string;
  status: "active" | "inactive";
  uid: string;
  families?: Record<string, string>;
  createdAt: string;
};

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function getRequestedFamilyId(req: NextRequest) {
  const headerFamilyId = req.headers.get("x-family-id");
  if (headerFamilyId) return headerFamilyId;

  const url = new URL(req.url);
  return url.searchParams.get("familyId");
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
  const adminFamilyIds = Object.entries(families)
    .filter(([, role]) => role === "admin")
    .map(([familyId]) => familyId);
  const isAdmin = adminFamilyIds.length > 0;
  if (!isAdmin) {
    throw new Error("Admin access required");
  }

  const requestedFamilyId = getRequestedFamilyId(req);
  if (requestedFamilyId && !adminFamilyIds.includes(requestedFamilyId)) {
    throw new Error("Admin access required for selected family");
  }

  const primaryFamilyId = requestedFamilyId || adminFamilyIds[0] || null;
  return { uid: (adminProfile as any)?.uid || adminSnap.id, primaryFamilyId };
}

export async function GET(req: NextRequest) {
  try {
    const { primaryFamilyId } = await verifyAdmin(req);
    if (!primaryFamilyId) {
      return NextResponse.json({ users: [] });
    }

    const membersSnap = await getAdminDb()
      .collection("families")
      .doc(primaryFamilyId)
      .collection("members")
      .get();

    const memberUids = Array.from(
      new Set(
        membersSnap.docs
          .map((doc) => {
            const data = doc.data() as { uid?: string };
            return data?.uid || doc.id;
          })
          .filter((uid) => Boolean(uid))
      )
    );

    const mapUserDoc = (doc: FirebaseFirestore.DocumentSnapshot) => {
      const data = doc.data() as Partial<SystemUserDoc>;
      const resolvedUid = data.uid || doc.id;
      const loginEmail = data.loginEmail || data.email || "";
      const username =
        data.username ||
        (loginEmail.includes("@") ? loginEmail.split("@")[0] : "") ||
        resolvedUid.slice(0, 8);
      const fullName = data.fullName || username;
      return {
        id: doc.id,
        uid: resolvedUid,
        fullName,
        username,
        loginEmail,
        userId: data.userId || `USR-${resolvedUid.slice(0, 4).toUpperCase()}`,
        status: (data.status || "active") as "active" | "inactive",
        email: data.email || loginEmail,
      };
    };

    // If members subcollection is empty, fall back to querying system_users by family membership
    if (memberUids.length === 0) {
      const byFamily = await getAdminDb()
        .collection("system_users")
        .where(`families.${primaryFamilyId}`, "in", ["admin", "member", "viewer"])
        .get();

      if (byFamily.empty) {
        return NextResponse.json({ users: [] });
      }

      const users = byFamily.docs
        .filter((doc) => doc.exists)
        .map(mapUserDoc)
        .filter((user, index, arr) => arr.findIndex((u) => u.uid === user.uid) === index)
        .sort((a, b) => a.username.localeCompare(b.username));

      return NextResponse.json({ users });
    }

    const userDocs = await Promise.all(
      memberUids.map(async (uid) => {
        const direct = await getAdminDb().collection("system_users").doc(uid).get();
        if (direct.exists) return direct;

        const byUid = await getAdminDb()
          .collection("system_users")
          .where("uid", "==", uid)
          .limit(1)
          .get();

        if (!byUid.empty) return byUid.docs[0];
        return null;
      })
    );

    const users = userDocs
      .filter((doc) => !!doc && doc.exists)
      .map((doc) => mapUserDoc(doc!))
      .filter((user, index, arr) => arr.findIndex((u) => u.uid === user.uid) === index)
      .sort((a, b) => a.username.localeCompare(b.username));

    return NextResponse.json({ users });
  } catch (error: any) {
    const message = error?.message || "Unauthorized";
    const status = message.includes("Admin") || message.includes("token") ? 403 : 401;
    return NextResponse.json({ error: message }, { status });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { primaryFamilyId } = await verifyAdmin(req);
    const body = await req.json();

    const fullName = String(body?.fullName || "").trim();
    const username = String(body?.username || "").trim().toLowerCase();
    const userId = String(body?.userId || "").trim();
    const password = String(body?.password || "");
    const status = body?.status === "inactive" ? "inactive" : "active";
    const email = String(body?.email || "").trim();
    const loginEmail = String(body?.loginEmail || "").trim() || (email || `${username}@clearport.local`);

    if (!fullName || !username || !password || !userId) {
      return NextResponse.json({ error: "Missing required fields." }, { status: 400 });
    }

    const duplicateUsername = await getAdminDb()
      .collection("system_users")
      .where("username", "==", username)
      .limit(1)
      .get();

    if (!duplicateUsername.empty) {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    const duplicateUserId = await getAdminDb()
      .collection("system_users")
      .where("userId", "==", userId)
      .limit(1)
      .get();

    if (!duplicateUserId.empty) {
      return NextResponse.json({ error: "User ID already exists." }, { status: 409 });
    }

    const authUser = await getAdminAuth().createUser({
      email: loginEmail,
      password,
      displayName: fullName,
      disabled: status === "inactive",
    });

    const families = primaryFamilyId ? { [primaryFamilyId]: "member" } : {};
    const newUserDoc: SystemUserDoc = {
      fullName,
      username,
      userId,
      email,
      loginEmail,
      status,
      uid: authUser.uid,
      families,
      createdAt: new Date().toISOString(),
    };

    await getAdminDb().collection("system_users").doc(authUser.uid).set(newUserDoc);

    if (primaryFamilyId) {
      const now = new Date().toISOString();
      await getAdminDb()
        .collection("families")
        .doc(primaryFamilyId)
        .collection("members")
        .doc(authUser.uid)
        .set({
          uid: authUser.uid,
          role: "member",
          email,
          fullName,
          addedAt: now,
          joinedAt: now,
        });
    }

    return NextResponse.json({ uid: authUser.uid }, { status: 201 });
  } catch (error: any) {
    console.error("POST /api/admin/users failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to create user." }, { status: 500 });
  }
}
