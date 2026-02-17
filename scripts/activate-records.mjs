// Script to activate all inactive records in Firebase using the client SDK
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, updateDoc, doc, writeBatch } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyAc6VfX2_Mx2j4X9hdp5ZtAkH2-VkyBdLM",
  authDomain: "daily-expense-report-2de2d.firebaseapp.com",
  projectId: "daily-expense-report-2de2d",
  storageBucket: "daily-expense-report-2de2d.firebasestorage.app",
  messagingSenderId: "129632465691",
  appId: "1:129632465691:web:25c7b709c29118f5c019be",
  measurementId: "G-F10TB12DFJ"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function activateAllInactiveRecords() {
  try {
    console.log('Fetching all expenses...');
    const snapshot = await getDocs(collection(db, 'expenses'));
    
    let inactiveCount = 0;
    const inactiveRecords = [];
    
    snapshot.docs.forEach(docSnapshot => {
      const data = docSnapshot.data();
      if (data.status === 'inactive') {
        inactiveCount++;
        inactiveRecords.push({
          id: docSnapshot.id,
          description: data.Description || 'No description',
          date: data.Date,
          paymentMethod: data.Payment_Method || data['Payment Method'] || 'N/A',
          amount: data.Amount || 0
        });
      }
    });
    
    console.log(`\nFound ${inactiveCount} inactive records:`);
    inactiveRecords.forEach(record => {
      console.log(`  - ${record.date}: $${record.amount} - ${record.paymentMethod} - ${record.description.substring(0, 50)}`);
    });
    
    if (inactiveCount > 0) {
      console.log(`\nActivating ${inactiveCount} inactive records...`);
      
      // Firestore batch has a limit of 500 operations
      const batchSize = 500;
      for (let i = 0; i < inactiveRecords.length; i += batchSize) {
        const batch = writeBatch(db);
        const batchRecords = inactiveRecords.slice(i, Math.min(i + batchSize, inactiveRecords.length));
        
        batchRecords.forEach(record => {
          const docRef = doc(db, 'expenses', record.id);
          batch.update(docRef, { status: 'active' });
        });
        
        await batch.commit();
        console.log(`  Activated batch ${Math.floor(i / batchSize) + 1} (${batchRecords.length} records)`);
      }
      
      console.log(`\n✅ Successfully activated ${inactiveCount} records!`);
    } else {
      console.log('\nNo inactive records found.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

activateAllInactiveRecords();
