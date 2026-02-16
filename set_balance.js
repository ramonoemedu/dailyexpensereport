const { initializeApp } = require('firebase/app');
const { getFirestore, doc, setDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAc6VfX2_Mx2j4X9hdp5ZtAkH2-VkyBdLM",
  authDomain: "daily-expense-report-2de2d.firebaseapp.com",
  projectId: "daily-expense-report-2de2d",
  storageBucket: "daily-expense-report-2de2d.firebasestorage.app",
  messagingSenderId: "129632465691",
  appId: "1:129632465691:web:25c7b709c29118f5c019be"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function setBalances() {
  try {
    // Set January to $291.81 (optional if already set, but good for consistency)
    await setDoc(doc(db, 'settings', 'balance_2026_0'), {
      amount: 291.81,
      updatedAt: new Date().toISOString()
    });
    
    // Set February to $291.81 as requested
    await setDoc(doc(db, 'settings', 'balance_2026_1'), {
      amount: 291.81,
      updatedAt: new Date().toISOString()
    });
    
    console.log('Successfully set January and February 2026 balances to $291.81');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e);
    process.exit(1);
  }
}

setBalances();