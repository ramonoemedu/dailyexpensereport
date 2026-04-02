import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type PendingMemberInput = {
  fullName?: string;
  username?: string;
  userId?: string;
  email?: string;
  password?: string;
};

type CanonicalProfile = {
  fullName?: string;
  username?: string;
  userId?: string;
  email?: string;
  loginEmail?: string;
  status?: "active" | "inactive";
  uid?: string;
  families?: Record<string, string>;
  createdAt?: string;
};

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

function normalizeUsernameFromEmail(email: string | undefined, fallback: string) {
  const base = (email || "").split("@")[0] || fallback;
  return base.toLowerCase().replace(/[^a-z0-9._-]/g, "").slice(0, 24) || "user";
}

async function resolveCanonicalUser(uid: string) {
  const db = getAdminDb();
  const byDocId = await db.collection("system_users").doc(uid).get();
  if (byDocId.exists) {
    return { ref: byDocId.ref, data: (byDocId.data() || {}) as CanonicalProfile };
  }

  const byUid = await db.collection("system_users").where("uid", "==", uid).limit(20).get();
  if (byUid.empty) {
    return { ref: db.collection("system_users").doc(uid), data: null as CanonicalProfile | null };
  }

  const ranked = byUid.docs
    .map((d) => ({ id: d.id, data: (d.data() || {}) as CanonicalProfile }))
    .sort((a, b) => {
      const aFamilies = Object.keys(a.data.families || {}).length;
      const bFamilies = Object.keys(b.data.families || {}).length;
      if (aFamilies !== bFamilies) return bFamilies - aFamilies;
      if (a.id === uid) return -1;
      if (b.id === uid) return 1;
      return 0;
    });

  return { ref: db.collection("system_users").doc(uid), data: ranked[0].data };
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const body = await req.json();

    const familyName = String(body?.familyName || "").trim();
    const members = Array.isArray(body?.members) ? (body.members as PendingMemberInput[]) : [];

    if (!familyName) {
      return NextResponse.json({ error: "Family name is required." }, { status: 400 });
    }

    const { ref: ownerRef, data: ownerExisting } = await resolveCanonicalUser(decoded.uid);
    const ownerFamilies = ownerExisting?.families || {};
    if (Object.keys(ownerFamilies).length > 0) {
      return NextResponse.json(
        { error: "Onboarding already completed for this user.", currentFamilyId: Object.keys(ownerFamilies)[0] },
        { status: 409 }
      );
    }

    const db = getAdminDb();
    const now = new Date().toISOString();

    const familyRef = db.collection("families").doc();
    const familyId = familyRef.id;

    await familyRef.set({
      name: familyName,
      createdBy: decoded.uid,
      createdAt: now,
      status: "active",
    });

    await familyRef.collection("members").doc(decoded.uid).set({
      uid: decoded.uid,
      role: "admin",
      fullName: decoded.name || "Owner",
      email: decoded.email || "",
      addedAt: now,
      joinedAt: now,
    });

    await familyRef.collection("settings").doc("config").set(
      {
        balances: [],
        cashBalances: [],
        expenseTypes: ["Food", "Transportation", "Utilities", "Other"],
        incomeTypes: [],
        incomeConfigs: [],
        updatedAt: now,
      },
      { merge: true }
    );

    const ownerUsername = normalizeUsernameFromEmail(decoded.email, decoded.uid);
    await ownerRef.set(
      {
        uid: decoded.uid,
        fullName: ownerExisting?.fullName || decoded.name || "Owner",
        username: ownerExisting?.username || ownerUsername,
        userId: ownerExisting?.userId || `OWNER-${decoded.uid.slice(0, 6).toUpperCase()}`,
        email: ownerExisting?.email || decoded.email || "",
        loginEmail: ownerExisting?.loginEmail || decoded.email || "",
        status: ownerExisting?.status || "active",
        families: {
          ...(ownerExisting?.families || {}),
          [familyId]: "admin",
        },
        updatedAt: now,
        createdAt: ownerExisting?.createdAt || now,
      },
      { merge: true }
    );

    const createdMembers: Array<{ uid: string; username: string; loginEmail: string; userId: string }> = [];
    const memberErrors: Array<{ username: string; error: string }> = [];

    for (const rawMember of members) {
      const fullName = String(rawMember?.fullName || "").trim();
      const username = String(rawMember?.username || "").trim().toLowerCase();
      const userId = String(rawMember?.userId || "").trim();
      const email = String(rawMember?.email || "").trim();
      const password = String(rawMember?.password || "");

      if (!fullName && !username && !userId && !email && !password) continue;

      if (!fullName || !username || !userId || !password) {
        memberErrors.push({ username: username || "(missing)", error: "fullName, username, userId and password are required." });
        continue;
      }

      try {
        const duplicateUsername = await db.collection("system_users").where("username", "==", username).limit(1).get();
        if (!duplicateUsername.empty) {
          memberErrors.push({ username, error: "Username already exists." });
          continue;
        }

        const duplicateUserId = await db.collection("system_users").where("userId", "==", userId).limit(1).get();
        if (!duplicateUserId.empty) {
          memberErrors.push({ username, error: "User ID already exists." });
          continue;
        }

        const loginEmail = email || `${username}@clearport.local`;
        const authUser = await getAdminAuth().createUser({
          email: loginEmail,
          password,
          displayName: fullName,
          disabled: false,
        });

        await db.collection("system_users").doc(authUser.uid).set({
          uid: authUser.uid,
          fullName,
          username,
          userId,
          email,
          loginEmail,
          status: "active",
          families: { [familyId]: "member" },
          createdAt: now,
        });

        await familyRef.collection("members").doc(authUser.uid).set({
          uid: authUser.uid,
          role: "member",
          fullName,
          email,
          addedAt: now,
          joinedAt: now,
        });

        createdMembers.push({ uid: authUser.uid, username, loginEmail, userId });
      } catch (memberError: any) {
        memberErrors.push({ username: username || "(unknown)", error: memberError?.message || "Failed to create member." });
      }
    }

    return NextResponse.json({
      success: true,
      familyId,
      familyName,
      createdMembers,
      memberErrors,
    });
  } catch (error: any) {
    console.error("POST /api/onboarding/complete failed:", error);
    return NextResponse.json({ error: error?.message || "Failed to complete onboarding." }, { status: 500 });
  }
}
