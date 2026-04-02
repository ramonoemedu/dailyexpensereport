import { signInWithEmailAndPassword } from "firebase/auth";
import { auth } from "@/lib/firebase";

export async function signInUser({ email, password }: { email: string, password: string }) {
  // You can add additional logic here if needed (e.g., check user status, families, etc.)
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  return userCredential;
}
