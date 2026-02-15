const XLSX = require('xlsx');
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc, getDocs, deleteDoc, doc } = require('firebase/firestore');

// Firebase configuration
// REPLACE THESE WITH YOUR ACTUAL KEYS
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

const FILE_PATH = 'Daily Expense Report for 2026 (2).xlsx';

function excelDateToJSDate(serial) {
  if (typeof serial === 'string') return serial;
  const utc_days  = Math.floor(serial - 25569);
  const utc_value = utc_days * 86400;                                        
  const date_info = new Date(utc_value * 1000);
  const fractional_day = serial - Math.floor(serial) + 0.0000001;
  let total_seconds = Math.floor(86400 * fractional_day);
  const seconds = total_seconds % 60;
  total_seconds -= seconds;
  const hours = Math.floor(total_seconds / (60 * 60));
  const minutes = Math.floor(total_seconds / 60) % 60;
  
  const d = new Date(date_info.getFullYear(), date_info.getMonth(), date_info.getDate(), hours, minutes, seconds);
  return d.toISOString().split('T')[0]; // Return YYYY-MM-DD
}

async function importData() {
  console.log('Reading Excel file...');
  const workbook = XLSX.readFile(FILE_PATH);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

  // Columns based on my investigation:
  // Column 3: Date
  // Column 4: Payment Method
  // Column 5: Description
  // Column 6: Amount
  // Column 7: Remain

  const expenses = [];
  for (let i = 2; i < data.length; i++) {
    const row = data[i];
    if (!row[3] && !row[5]) continue; // Skip empty rows

    const expense = {
      Date: row[3] ? excelDateToJSDate(row[3]) : '',
      Payment_Method: row[4] || '',
      Description: row[5] || '',
      Amount: row[6] || 0,
      Remaining_Balance: row[7] || 0
    };
    expenses.push(expense);
  }

  console.log(`Found ${expenses.length} records. Importing to Firebase...`);

  const expensesCol = collection(db, 'expenses');
  
  for (const exp of expenses) {
    try {
      await addDoc(expensesCol, exp);
      console.log(`Imported: ${exp.Date} - ${exp.Description}`);
    } catch (e) {
      console.error('Error importing record:', e);
    }
  }

  console.log('Import completed!');
  process.exit(0);
}

importData().catch(console.error);
