import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function POST(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();
    const { familyId } = await req.json();

    if (!familyId) {
      return NextResponse.json({ error: "familyId is required" }, { status: 400 });
    }

    // Resolve user profile (doc id, uid field, loginEmail/email fallback)
    const byDocId = await db.collection("system_users").doc(decoded.uid).get();
    let profileDoc = byDocId.exists ? byDocId : null;

    if (!profileDoc) {
      const byUid = await db.collection("system_users").where("uid", "==", decoded.uid).limit(1).get();
      if (!byUid.empty) {
        profileDoc = byUid.docs[0];
      }
    }

    if (!profileDoc && decoded.email) {
      const byLoginEmail = await db
        .collection("system_users")
        .where("loginEmail", "==", decoded.email)
        .limit(1)
        .get();
      if (!byLoginEmail.empty) {
        profileDoc = byLoginEmail.docs[0];
      }
    }

    if (!profileDoc && decoded.email) {
      const byEmail = await db
        .collection("system_users")
        .where("email", "==", decoded.email)
        .limit(1)
        .get();
      if (!byEmail.empty) {
        profileDoc = byEmail.docs[0];
      }
    }

    const profile = profileDoc?.data() || {};
    const profileUid = (profile?.uid as string | undefined) || profileDoc?.id || decoded.uid;
    const families = (profile.families as Record<string, string>) || {};
    const isSystemAdmin = profile?.systemAdmin === true;

    // Verify user has access to this family.
    // System admins can switch to any family.
    // For regular users, check profile families map or canonical members/{uid} doc.
    let userRole = families[familyId] || null;

    if (!isSystemAdmin) {
      if (!userRole) {
        const memberByAuthUid = await db
          .collection("families")
          .doc(familyId)
          .collection("members")
          .doc(decoded.uid)
          .get();

        if (memberByAuthUid.exists) {
          userRole = (memberByAuthUid.data() as Record<string, any>)?.role || "member";
        }
      }

      if (!userRole && profileUid !== decoded.uid) {
        const memberByProfileUid = await db
          .collection("families")
          .doc(familyId)
          .collection("members")
          .doc(profileUid)
          .get();

        if (memberByProfileUid.exists) {
          userRole = (memberByProfileUid.data() as Record<string, any>)?.role || "member";
        }
      }

      if (!userRole) {
        return NextResponse.json(
          { error: "User does not have access to this family" },
          { status: 403 }
        );
      }
    } else {
      // System admin viewing any family — assign admin role if not already set
      userRole = userRole || "admin";
    }

    // Get family details
    const familyDoc = await db.collection("families").doc(familyId).get();
    if (!familyDoc.exists) {
      return NextResponse.json({ error: "Family not found" }, { status: 404 });
    }

    const familyData = familyDoc.data() as Record<string, any> | undefined;
    if (!familyData) {
      return NextResponse.json({ error: "Family data is invalid" }, { status: 404 });
    }

    return NextResponse.json({
      success: true,
      familyId,
      familyName: familyData.name || "Unknown",
      userRole,
      profile,
    });
  } catch (error) {
    console.error("/api/users/me/switch-family POST failed:", error);
    return NextResponse.json({ error: "Family switch failed" }, { status: 500 });
  }
}
