import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import * as dotenv from "dotenv";

dotenv.config({ path: '.env.local' }); 

async function testLogin() {
  const { auth, db } = await import("../src/lib/firebase");

  // Using the exact email from your database document
  const email = "ramonoem@clearport.local"; 
  const password = "123456";
  const uid = "uGGXOe4cs2OgsBX93ZkhpVXCwB72"; // Replace with the correct UID if needed
  const familyId = "HfLedbulpkLaeFMXwkVK";

  try {
    console.log(`Trying to log in as ${email}...`);
    await signInWithEmailAndPassword(auth, email, password);
    console.log("✅ Login successful!");
    
  } catch (err: any) {
    console.error("❌ Login failed:", err.code);
    
    // If the login fails, let's try creating the user in the Auth system!
    console.log("\nAttempting to register this user in Firebase Auth instead...");
    try {
      await createUserWithEmailAndPassword(auth, email, password);
      console.log("✅ User successfully created in Auth and logged in!");
    } catch (createErr: any) {
      console.error("❌ Registration failed:", createErr.code);
      if (createErr.code === 'auth/email-already-in-use') {
        console.log("💡 Tip: The user exists in Auth, but the password isn't 123456. You may need to delete them in the Firebase Console and recreate them.");
      }
    }
  }

  // Ensure Firestore system_users and family member are set up for admin access
  try {
    // system_users/{uid}
    await setDoc(doc(db, "system_users", uid), {
      email: "",
      loginEmail: email,
      status: "active",
      families: { [familyId]: "admin" },
      fullName: "Vat Sopheap",
      userId: "002",
      username: "vatsopheap",
      createdAt: new Date().toISOString(),
      uid,
    }, { merge: true });
    // families/{familyId}/members/{uid}
    await setDoc(doc(db, `families/${familyId}/members/${uid}`), {
      role: "admin",
      addedAt: new Date().toISOString(),
    }, { merge: true });
    console.log("✅ Firestore admin profile and family member ensured.");
  } catch (firestoreErr: any) {
    console.error("❌ Firestore update failed:", firestoreErr.message || firestoreErr);
  }
}

testLogin();