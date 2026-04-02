import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth, getAdminDb } from "@/lib/firebaseAdmin";

type RegisterBody = {
  fullName?: string;
  username?: string;
  userId?: string;
  email?: string;
  password?: string;
};

function normalizeUsername(raw: string) {
  return raw.toLowerCase().trim().replace(/[^a-z0-9._-]/g, "");
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as RegisterBody;
    const fullName = String(body?.fullName || "").trim();
    const username = normalizeUsername(String(body?.username || ""));
    const userId = String(body?.userId || "").trim();
    const email = String(body?.email || "").trim().toLowerCase();
    const password = String(body?.password || "");

    if (!fullName || !username || !userId || !email || !password) {
      return NextResponse.json({ error: "fullName, username, userId, email and password are required." }, { status: 400 });
    }

    if (password.length < 6) {
      return NextResponse.json({ error: "Password must be at least 6 characters." }, { status: 400 });
    }

    const db = getAdminDb();

    const [duplicateUsername, duplicateUserId] = await Promise.all([
      db.collection("system_users").where("username", "==", username).limit(1).get(),
      db.collection("system_users").where("userId", "==", userId).limit(1).get(),
    ]);

    if (!duplicateUsername.empty) {
      return NextResponse.json({ error: "Username already exists." }, { status: 409 });
    }

    if (!duplicateUserId.empty) {
      return NextResponse.json({ error: "User ID already exists." }, { status: 409 });
    }

    const authUser = await getAdminAuth().createUser({
      email,
      password,
      displayName: fullName,
      disabled: false,
    });

    const now = new Date().toISOString();
    await db.collection("system_users").doc(authUser.uid).set({
      uid: authUser.uid,
      fullName,
      username,
      userId,
      email,
      loginEmail: email,
      status: "active",
      families: {},
      createdAt: now,
      updatedAt: now,
    });

    return NextResponse.json({ success: true, uid: authUser.uid, loginEmail: email }, { status: 201 });
  } catch (error: any) {
    const code = error?.code || "";
    if (code === "auth/email-already-exists") {
      return NextResponse.json({ error: "Email already exists." }, { status: 409 });
    }
    if (code === "auth/invalid-password" || code === "auth/weak-password") {
      return NextResponse.json({ error: "Password is too weak." }, { status: 400 });
    }

    console.error("POST /api/auth/register failed:", error);
    return NextResponse.json({ error: error?.message || "Registration failed." }, { status: 500 });
  }
}
