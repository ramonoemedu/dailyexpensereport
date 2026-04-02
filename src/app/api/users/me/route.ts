import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

export async function GET(req: NextRequest) {
  try {
    const token = getBearerToken(req);
    if (!token) {
      return NextResponse.json({ error: "Missing bearer token" }, { status: 401 });
    }

    const decoded = await getAdminAuth().verifyIdToken(token);
    const db = getAdminDb();

    let profile: Record<string, any> | null = null;
    let currentFamilyId: string | null = null;
    let userRole: string | null = null;

    const byDocId = await db.collection("system_users").doc(decoded.uid).get();
    const byUid = await db
      .collection("system_users")
      .where("uid", "==", decoded.uid)
      .limit(20)
      .get();

    let byLoginEmailDocs: Array<{ id: string; data: Record<string, any> }> = [];
    let byEmailDocs: Array<{ id: string; data: Record<string, any> }> = [];

    if (decoded.email) {
      const byLoginEmail = await db
        .collection("system_users")
        .where("loginEmail", "==", decoded.email)
        .limit(20)
        .get();
      byLoginEmailDocs = byLoginEmail.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));

      const byEmail = await db
        .collection("system_users")
        .where("email", "==", decoded.email)
        .limit(20)
        .get();
      byEmailDocs = byEmail.docs.map((d) => ({ id: d.id, data: d.data() as Record<string, any> }));
    }

    const candidates: Array<{ id: string; data: Record<string, any> }> = [];
    if (byDocId.exists) {
      candidates.push({ id: byDocId.id, data: byDocId.data() as Record<string, any> });
    }
    byUid.docs.forEach((d) => {
      if (!candidates.some((c) => c.id === d.id)) {
        candidates.push({ id: d.id, data: d.data() as Record<string, any> });
      }
    });
    byLoginEmailDocs.forEach((d) => {
      if (!candidates.some((c) => c.id === d.id)) {
        candidates.push(d);
      }
    });
    byEmailDocs.forEach((d) => {
      if (!candidates.some((c) => c.id === d.id)) {
        candidates.push(d);
      }
    });

    if (candidates.length > 0) {
      const ranked = candidates.sort((a, b) => {
        const aFamilies = Object.keys(a.data.families || {}).length;
        const bFamilies = Object.keys(b.data.families || {}).length;
        if (aFamilies !== bFamilies) return bFamilies - aFamilies;
        return a.id === decoded.uid ? -1 : b.id === decoded.uid ? 1 : 0;
      });
      profile = ranked[0].data;
    }

    const resolvedProfileUid = (profile?.uid as string | undefined) || null;

    // Merge any family memberships discovered from members subcollections.
    const mergedFamilies: Record<string, string> = {
      ...((profile?.families as Record<string, string>) || {}),
    };

    // System admins get access to ALL families.
    const isSystemAdmin = profile?.systemAdmin === true;
    if (isSystemAdmin) {
      const allFamiliesSnap = await db.collection("families").get();
      for (const famDoc of allFamiliesSnap.docs) {
        if (!mergedFamilies[famDoc.id]) {
          mergedFamilies[famDoc.id] = "admin";
        }
      }
    }

    // Important for performance: only scan families collection when no family map exists yet.
    if (!isSystemAdmin && Object.keys(mergedFamilies).length === 0) {
      const familiesSnap = await db.collection("families").limit(200).get();
      for (const familyDoc of familiesSnap.docs) {
        const memberByAuthUid = await db
          .collection("families")
          .doc(familyDoc.id)
          .collection("members")
          .doc(decoded.uid)
          .get();

        if (memberByAuthUid.exists) {
          mergedFamilies[familyDoc.id] =
            ((memberByAuthUid.data() as Record<string, any>)?.role as string | undefined) ||
            mergedFamilies[familyDoc.id] ||
            "member";
        }

        if (resolvedProfileUid && resolvedProfileUid !== decoded.uid) {
          const memberByProfileUid = await db
            .collection("families")
            .doc(familyDoc.id)
            .collection("members")
            .doc(resolvedProfileUid)
            .get();

          if (memberByProfileUid.exists) {
            mergedFamilies[familyDoc.id] =
              ((memberByProfileUid.data() as Record<string, any>)?.role as string | undefined) ||
              mergedFamilies[familyDoc.id] ||
              "member";
          }
        }
      }
    }

    if (profile) {
      profile.families = mergedFamilies;
    }

    // Sync families to the uid-keyed system_users doc so client-side Firestore
    // security rules (isFamilyMember → hasFamilyInUidUserDoc) work correctly,
    // even when the user profile is stored under a different document ID.
    if (Object.keys(mergedFamilies).length > 0) {
      try {
        await db.collection('system_users').doc(decoded.uid).set(
          { uid: decoded.uid, families: mergedFamilies },
          { merge: true }
        );
      } catch (syncErr) {
        console.warn('/api/users/me: Failed to sync uid-keyed doc:', syncErr);
      }
    }

    const families = mergedFamilies;
    const familyIds = Object.keys(families);
    if (familyIds.length > 0) {
      currentFamilyId = familyIds[0];
      userRole = families[currentFamilyId] || null;
    }

    const familyNameEntries = await Promise.all(
      familyIds.map(async (fid) => {
        const snap = await db.collection('families').doc(fid).get();
        return [fid, (snap.data() as { name?: string } | undefined)?.name || fid] as const;
      })
    );
    const familyNames = Object.fromEntries(familyNameEntries);

    if (!profile) {
      profile = {
        uid: decoded.uid,
        username: decoded.name || decoded.email?.split("@")[0] || "user",
        loginEmail: decoded.email || "",
        email: decoded.email || "",
        status: "active",
        families: currentFamilyId ? { [currentFamilyId]: userRole || "member" } : {},
      };
    } else if (!currentFamilyId) {
      const profileFamilyIds = Object.keys((profile.families as Record<string, string>) || {});
      if (profileFamilyIds.length > 0) {
        currentFamilyId = profileFamilyIds[0];
        userRole = (profile.families as Record<string, string>)[currentFamilyId] || userRole;
      }
    }

    return NextResponse.json({
      uid: decoded.uid,
      profile,
      currentFamilyId,
      userRole,
      familyNames,
    });
  } catch (error) {
    console.error("/api/users/me GET failed:", error);
    return NextResponse.json({ error: "User context resolution failed" }, { status: 500 });
  }
}
