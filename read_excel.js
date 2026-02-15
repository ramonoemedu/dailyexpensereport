const XLSX = require('xlsx');
const path = require('path');
const workbook = XLSX.readFile(path.join(__dirname, 'Daily Expense Report for 2026 (2).xlsx'));
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

for (let i = 0; i < Math.min(data.length, 50); i++) {
  console.log(`Row ${i}:`, data[i]);
}
