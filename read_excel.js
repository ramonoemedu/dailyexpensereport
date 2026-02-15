const XLSX = require('xlsx');
const workbook = XLSX.readFile('/Users/ramonoem/Documents/Documents/Ramon/My Project/portalsystemclearport/Daily Expense Report for 2026 (2).xlsx');
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
for (let i = 0; i < 10; i++) {
  console.log(`Row ${i}:`, data[i]);
}
