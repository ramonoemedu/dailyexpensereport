import { NextRequest, NextResponse } from "next/server";
import { getAdminDb } from "@/lib/firebaseAdmin";

type ResolveBody = {
  identifier?: string;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ResolveBody;
    const identifier = body.identifier?.trim();

    if (!identifier) {
      return NextResponse.json({ error: "Identifier is required." }, { status: 400 });
    }

    // If already an email, no lookup is needed.
    if (identifier.includes("@")) {
      return NextResponse.json({ loginEmail: identifier });
    }

    const db = getAdminDb();
    const normalizedUsername = identifier.toLowerCase();
    const normalizedUserId = identifier.toUpperCase();
    const rawUserId = identifier;
    const userIdAsNumber = Number.isNaN(Number(rawUserId)) ? null : Number(rawUserId);

    const [usernameSnap, userIdSnap, userIdRawSnap, userIdNumberSnap] = await Promise.all([
      db.collection("system_users").where("username", "==", normalizedUsername).limit(1).get(),
      db.collection("system_users").where("userId", "==", normalizedUserId).limit(1).get(),
      db.collection("system_users").where("userId", "==", rawUserId).limit(1).get(),
      userIdAsNumber !== null
        ? db.collection("system_users").where("userId", "==", userIdAsNumber).limit(1).get()
        : Promise.resolve(null),
    ]);

    const candidate = !usernameSnap.empty
      ? usernameSnap.docs[0]
      : !userIdSnap.empty
        ? userIdSnap.docs[0]
        : !userIdRawSnap.empty
          ? userIdRawSnap.docs[0]
          : userIdNumberSnap && !userIdNumberSnap.empty
            ? userIdNumberSnap.docs[0]
            : null;

    if (!candidate) {
      return NextResponse.json({ error: "Username or User ID not found." }, { status: 404 });
    }

    const userData = candidate.data() as {
      status?: string;
      loginEmail?: string;
      username?: string;
    };

    if (userData.status === "inactive") {
      return NextResponse.json({ error: "This account is currently inactive." }, { status: 403 });
    }

    const loginEmail = userData.loginEmail || `${userData.username}@clearport.local`;
    return NextResponse.json({ loginEmail });
  } catch (error) {
    console.error("resolve-identifier failed", error);
    return NextResponse.json({ error: "Login system error. Please try again later." }, { status: 500 });
  }
}
