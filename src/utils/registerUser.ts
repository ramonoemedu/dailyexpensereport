import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "@/lib/firebase";
import {
  doc,
  setDoc,
  writeBatch,
  collection,
} from "firebase/firestore";

export async function registerUser({ email, password, fullName }: { email: string, password: string, fullName: string }) {
  // 1. Create Auth user
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  const { uid } = userCredential.user;
  await updateProfile(userCredential.user, { displayName: fullName });

  // 2. Create new family
  const familyRef = doc(collection(db, "families"));
  const familyId = familyRef.id;

  // 3. Prepare batched writes
  const batch = writeBatch(db);

  // 3a. families/{familyId}
  batch.set(familyRef, {
    name: "My Family",
    createdAt: new Date().toISOString(),
    createdBy: uid,
  });

  // 3b. families/{familyId}/members/{uid}
  batch.set(doc(db, `families/${familyId}/members/${uid}`), {
    role: "admin",
    joinedAt: new Date().toISOString(),
    email,
    fullName,
  });

  // 3c. system_users/{uid}
  batch.set(doc(db, `system_users/${uid}`), {
    email,
    status: "active",
    families: { [familyId]: "admin" },
    createdAt: new Date().toISOString(),
    fullName,
  });

  // 3d. families/{familyId}/settings/config
  batch.set(doc(db, `families/${familyId}/settings/config`), {
    expenseTypes: [],
    incomeTypes: [],
  });

  // 4. Commit batch
  await batch.commit();

  return { uid, familyId };
}
