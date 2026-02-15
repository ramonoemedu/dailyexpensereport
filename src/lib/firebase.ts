import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAc6VfX2_Mx2j4X9hdp5ZtAkH2-VkyBdLM",
  authDomain: "daily-expense-report-2de2d.firebaseapp.com",
  projectId: "daily-expense-report-2de2d",
  storageBucket: "daily-expense-report-2de2d.firebasestorage.app",
  messagingSenderId: "129632465691",
  appId: "1:129632465691:web:25c7b709c29118f5c019be",
  measurementId: "G-F10TB12DFJ"
};

const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { auth, db };
