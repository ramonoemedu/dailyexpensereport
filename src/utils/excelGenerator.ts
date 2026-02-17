import ExcelJS from 'exceljs';
import { saveAs } from 'file-saver';
import dayjs from 'dayjs';

export const generateExcel = async (
  title: string,
  columns: string[],
  rows: Record<string, any>[],
  bankName: string
) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(bankName || 'Financial Report');

  // 1. Setup Worksheet View
  worksheet.views = [{ showGridLines: false }]; // Modern look: no gridlines

  // 2. Define Columns with specific widths
  worksheet.columns = [
    { width: 18 }, // Date
    { width: 45 }, // Description
    { width: 20 }, // Payment Method
    { width: 20 }, // Category
    { width: 15 }, // Type
    { width: 12 }, // Currency
    { width: 18 }, // Amount/Debit
    { width: 18 }, // Credit
  ];

  // 3. Brand Header
  worksheet.mergeCells('A1:H1');
  const brandCell = worksheet.getCell('A1');
  brandCell.value = 'DAILY EXPENSE SYSTEM';
  brandCell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF94A3B8' } };
  brandCell.alignment = { horizontal: 'left' };

  // 4. Main Title
  worksheet.mergeCells('A2:H3');
  const titleCell = worksheet.getCell('A2');
  titleCell.value = `${title.toUpperCase()}\n${bankName.toUpperCase()}`;
  titleCell.font = { name: 'Arial', size: 20, bold: true, color: { argb: 'FF1E293B' } };
  titleCell.alignment = { vertical: 'middle', horizontal: 'left', wrapText: true };
  worksheet.getRow(2).height = 35;
  worksheet.getRow(3).height = 35;

  // 5. Meta Info (Date of export)
  worksheet.mergeCells('A4:H4');
  const metaCell = worksheet.getCell('A4');
  metaCell.value = `Statement Period: ${dayjs().format('MMMM YYYY')}  |  Generated: ${dayjs().format('DD MMM YYYY, HH:mm')}`;
  metaCell.font = { name: 'Arial', size: 9, color: { argb: 'FF64748B' } };
  metaCell.border = { bottom: { style: 'medium', color: { argb: 'FF006BFF' } } };

  // Space before table
  worksheet.addRow([]);

  // 6. Table Headers
  const headerRow = worksheet.getRow(6);
  headerRow.values = columns;
  headerRow.height = 30;
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1E293B' } // Slate 800
    };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF1E293B' } },
      bottom: { style: 'thin', color: { argb: 'FF1E293B' } }
    };
  });

  // 7. Data Rows
  rows.forEach((row, index) => {
    const isIncome = row.Type === "Income";
    const amount = Math.abs(parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || row["amount"] || 0).toString()));
    
    const dataRow = worksheet.addRow([
      row.Date ? dayjs(row.Date).format('DD-MMM-YYYY') : '',
      row.Description || row.description || '',
      row["Payment Method"] || row["Payment_Method"] || '',
      row.Category || row.category || '',
      row.Type || row.type || 'Expense',
      row.Currency || row.currency || 'USD',
      isIncome ? amount : null,
      !isIncome ? amount : null
    ]);

    dataRow.height = 25;
    const isEven = index % 2 === 0;

    dataRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF334155' } };
      cell.alignment = { vertical: 'middle', horizontal: 'left' };
      
      // Zebra Striping
      if (index % 2 !== 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF8FAFC' } // Slate 50
        };
      }

      // Accounting Borders
      cell.border = {
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      };

      // Currency Formatting
      const headerName = columns[colNumber - 1];
      if (headerName === "Debit" || headerName === "Credit" || headerName === "Amount") {
        cell.numFmt = '#,##0.00;[Red](#,##0.00)';
        cell.alignment = { horizontal: 'right' };
        if (headerName === "Debit" && cell.value) cell.font = { name: 'Arial', size: 10, color: { argb: 'FF10B981' }, bold: true };
        if (headerName === "Credit" && cell.value) cell.font = { name: 'Arial', size: 10, color: { argb: 'FFF43F5E' }, bold: true };
      }
    });
  });

  // 8. Totals Section
  const lastRowNumber = worksheet.lastRow!.number + 2;
  const totalDebit = rows.reduce((acc, row) => acc + (row.Type === "Income" ? parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || row["amount"] || 0).toString()) : 0), 0);
  const totalCredit = rows.reduce((acc, row) => acc + (row.Type !== "Income" ? parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || row["amount"] || 0).toString()) : 0), 0);
  const balance = totalDebit - totalCredit;

  // Labels
  worksheet.getCell(`F${lastRowNumber}`).value = 'TOTAL DEBIT (+)';
  worksheet.getCell(`F${lastRowNumber + 1}`).value = 'TOTAL CREDIT (-)';
  worksheet.getCell(`F${lastRowNumber + 2}`).value = 'NET RECONCILIATION';

  [lastRowNumber, lastRowNumber+1, lastRowNumber+2].forEach(rowIdx => {
    const cell = worksheet.getCell(`F${rowIdx}`);
    cell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF64748B' } };
    cell.alignment = { horizontal: 'right', vertical: 'middle' };
  });

  // Values
  const debitCell = worksheet.getCell(`G${lastRowNumber}`);
  debitCell.value = totalDebit;
  debitCell.numFmt = '#,##0.00';
  debitCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FF10B981' } };

  const creditCell = worksheet.getCell(`H${lastRowNumber + 1}`);
  creditCell.value = totalCredit;
  creditCell.numFmt = '#,##0.00';
  creditCell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFF43F5E' } };

  const balanceCell = worksheet.getCell(`G${lastRowNumber + 2}`);
  balanceCell.value = balance;
  balanceCell.numFmt = '"$"#,##0.00';
  balanceCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF006BFF' } };
  balanceCell.border = {
    top: { style: 'thin' },
    bottom: { style: 'double' } // Professional accounting double underline
  };
  worksheet.mergeCells(`G${lastRowNumber + 2}:H${lastRowNumber + 2}`);
  balanceCell.alignment = { horizontal: 'center' };

  // 9. Footer
  const footerRow = lastRowNumber + 5;
  worksheet.mergeCells(`A${footerRow}:H${footerRow}`);
  const foot = worksheet.getCell(`A${footerRow}`);
  foot.value = 'End of Statement - Confirmed and Verified';
  foot.font = { italic: true, size: 8, color: { argb: 'FF94A3B8' } };
  foot.alignment = { horizontal: 'center' };

  // Generate and Save
  const buffer = await workbook.xlsx.writeBuffer();
  const fileName = `${bankName.replace(/\s+/g, '_')}_Statement_${dayjs().format('YYYY-MM-DD')}.xlsx`;
  saveAs(new Blob([buffer]), fileName);
};