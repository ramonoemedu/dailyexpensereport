import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";
import { NextRequest } from "next/server";

function getBearerToken(req: NextRequest) {
  const authHeader = req.headers.get("authorization") || "";
  if (!authHeader.startsWith("Bearer ")) return null;
  return authHeader.slice(7);
}

type CachedAccess = { uid: string; role: string; expiry: number };
const accessCache = new Map<string, CachedAccess>();
const ACCESS_CACHE_TTL_MS = 30_000;

/**
 * Verifies that the request's bearer token belongs to a user who has access
 * to the given family. Result is cached for 30s to avoid repeated Auth + Firestore
 * reads on every API call.
 *
 * @returns { uid, role }
 * @throws if token is missing/invalid or user lacks access
 */
export async function verifyFamilyAccess(
  req: NextRequest,
  familyId: string,
  adminOnly = false
): Promise<{ uid: string; role: string }> {
  const token = getBearerToken(req);
  if (!token) throw new Error("Missing bearer token");

  const cacheKey = `${token}:${familyId}`;
  const cached = accessCache.get(cacheKey);
  if (cached && Date.now() < cached.expiry) {
    if (adminOnly && cached.role !== "admin") throw new Error("Family admin access required");
    return { uid: cached.uid, role: cached.role };
  }

  const decoded = await getAdminAuth().verifyIdToken(token);
  const db = getAdminDb();

  let familiesMap: Record<string, string> | undefined;

  // Fast path: uid-keyed doc (always present after /api/users/me sync)
  const byDocId = await db.collection("system_users").doc(decoded.uid).get();
  if (byDocId.exists) {
    familiesMap = (byDocId.data() as Record<string, any>)?.families;
  }

  // Fallback: profile stored under a different doc ID (migrated accounts)
  if (!familiesMap?.[familyId]) {
    const byUid = await db
      .collection("system_users")
      .where("uid", "==", decoded.uid)
      .limit(1)
      .get();
    if (!byUid.empty) {
      familiesMap = {
        ...(familiesMap || {}),
        ...((byUid.docs[0].data() as Record<string, any>)?.families || {}),
      };
    }
  }

  // Last resort: look up by login email
  if (!familiesMap?.[familyId] && decoded.email) {
    const byEmail = await db
      .collection("system_users")
      .where("loginEmail", "==", decoded.email)
      .limit(1)
      .get();
    if (!byEmail.empty) {
      familiesMap = {
        ...(familiesMap || {}),
        ...((byEmail.docs[0].data() as Record<string, any>)?.families || {}),
      };
    }
  }

  const role = familiesMap?.[familyId];
  if (!role) throw new Error("Family access denied");
  if (adminOnly && role !== "admin") throw new Error("Family admin access required");

  accessCache.set(cacheKey, { uid: decoded.uid, role, expiry: Date.now() + ACCESS_CACHE_TTL_MS });
  return { uid: decoded.uid, role };
}
