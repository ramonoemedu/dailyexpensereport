import { App, cert, getApps, initializeApp } from "firebase-admin/app";
import { Auth, getAuth } from "firebase-admin/auth";
import { Firestore, getFirestore } from "firebase-admin/firestore";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

let adminApp: App | null = null;
let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;

function getServiceAccount() {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (projectId && clientEmail && privateKey) {
    return {
      projectId,
      clientEmail,
      privateKey,
    };
  }

  // Local development fallback: read service account from workspace file.
  const serviceAccountPath = path.join(process.cwd(), "serviceAccountKey.json");
  if (existsSync(serviceAccountPath)) {
    const raw = readFileSync(serviceAccountPath, "utf8");
    const parsed = JSON.parse(raw) as {
      project_id?: string;
      client_email?: string;
      private_key?: string;
    };

    if (parsed.project_id && parsed.client_email && parsed.private_key) {
      return {
        projectId: parsed.project_id,
        clientEmail: parsed.client_email,
        privateKey: parsed.private_key,
      };
    }
  }

  return null;
}

export function getAdminApp() {
  if (adminApp) return adminApp;
  if (getApps().length > 0) {
    adminApp = getApps()[0]!;
  } else {
    const serviceAccount = getServiceAccount();
    if (serviceAccount) {
      adminApp = initializeApp({
        credential: cert(serviceAccount),
      });
    } else {
      // Fallback for managed runtimes (Cloud Run/Firebase App Hosting/GCP)
      // that provide Application Default Credentials.
      adminApp = initializeApp();
    }
  }
  return adminApp;
}

export function getAdminAuth() {
  if (adminAuth) return adminAuth;
  adminAuth = getAuth(getAdminApp());
  return adminAuth;
}

export function getAdminDb() {
  if (adminDb) return adminDb;
  const databaseId = process.env.FIRESTORE_DATABASE_ID || '(default)';
  adminDb = databaseId !== '(default)' ? getFirestore(getAdminApp(), databaseId) : getFirestore(getAdminApp());
  return adminDb;
}
