import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import dayjs from "dayjs";

export const generatePdf = (
  title: string,
  columns: string[],
  rows: Record<string, any>[],
  bankName: string
) => {
  const doc = new jsPDF({
    orientation: "landscape",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 15;

  // 1. Decorative Header (Brand Bar)
  doc.setFillColor(30, 41, 59); // Slate 800
  doc.rect(0, 0, pageWidth, 15, "F");
  
  doc.setFontSize(8);
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.text("DAILY EXPENSE SYSTEM  |  FINANCIAL RECONCILIATION", margin, 10);

  // 2. Main Title Section
  doc.setTextColor(15, 23, 42); // Slate 900
  doc.setFontSize(24);
  doc.setFont("helvetica", "bold");
  doc.text(title.toUpperCase(), margin, 35);
  
  doc.setFontSize(14);
  doc.setTextColor(0, 107, 255); // Primary Blue
  doc.text(bankName.toUpperCase(), margin, 43);

  // 3. Document Meta
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139); // Slate 500
  doc.setFont("helvetica", "normal");
  doc.text(`Statement Date: ${dayjs().format("DD MMMM YYYY")}`, margin, 52);
  doc.text(`Exported by: System Administrator`, margin, 57);

  // 4. Summary Card (Top Right)
  const totalDebit = rows.reduce((acc, row) => acc + (row.Type === "Income" ? parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || 0).toString()) : 0), 0);
  const totalCredit = rows.reduce((acc, row) => acc + (row.Type !== "Income" ? parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || 0).toString()) : 0), 0);
  const balance = totalDebit - totalCredit;

  const cardWidth = 80;
  const cardX = pageWidth - margin - cardWidth;
  const cardY = 25;

  doc.setDrawColor(226, 232, 240); // Slate 200
  doc.setFillColor(248, 250, 252); // Slate 50
  doc.roundedRect(cardX, cardY, cardWidth, 35, 3, 3, "FD");

  doc.setFontSize(8);
  doc.setTextColor(100, 116, 139);
  doc.text("NET POSITION", cardX + 5, cardY + 8);
  
  doc.setFontSize(18);
  doc.setTextColor(0, 107, 255);
  doc.setFont("helvetica", "bold");
  doc.text(`$${balance.toLocaleString(undefined, { minimumFractionDigits: 2 })}`, cardX + 5, cardY + 18);

  doc.setFontSize(8);
  doc.setTextColor(16, 185, 129); // Green
  doc.text(`IN: +$${totalDebit.toLocaleString()}`, cardX + 5, cardY + 28);
  doc.setTextColor(244, 63, 94); // Red
  doc.text(`OUT: -$${totalCredit.toLocaleString()}`, cardX + 45, cardY + 28);

  // 5. Transaction Ledger Table
  const tableData = rows.map((row) => {
    const isIncome = row.Type === "Income";
    const amount = Math.abs(parseFloat((row["Amount (Income/Expense)"] || row["Amount"] || 0).toString()));

    return [
      row.Date ? dayjs(row.Date).format("DD MMM YYYY") : "",
      row.Description || "",
      row.Category || "",
      row.Type || "",
      isIncome ? `+$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "",
      !isIncome ? `-$${amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "",
    ];
  });

  autoTable(doc, {
    startY: 65,
    head: [["DATE", "DESCRIPTION", "CATEGORY", "TYPE", "DEBIT (+)", "CREDIT (-)"]],
    body: tableData,
    theme: "plain",
    headStyles: {
      fillColor: [30, 41, 59],
      textColor: [255, 255, 255],
      fontSize: 8,
      fontStyle: "bold",
      halign: "center",
      cellPadding: 4,
    },
    styles: {
      fontSize: 8,
      font: "helvetica",
      cellPadding: 3,
      valign: "middle",
      textColor: [51, 65, 85],
    },
    columnStyles: {
      0: { cellWidth: 30 },
      1: { cellWidth: "auto" },
      4: { halign: "right", fontStyle: "bold", textColor: [16, 185, 129] }, // Debit
      5: { halign: "right", fontStyle: "bold", textColor: [244, 63, 94] }, // Credit
    },
            didParseCell: (data) => {
              if (data.section === 'body' && data.row.index % 2 !== 0) {
                data.cell.styles.fillColor = [248, 250, 252];
              }
              // Ensure all other borders are removed if we are drawing manually
              data.cell.styles.lineWidth = 0; // Remove default borders
            },
                didDrawCell: (data) => {
                  if (data.section === 'body') {
                    const { x, y, width, height } = data.cell;
                    const doc = data.doc as jsPDF;
            
                    doc.setDrawColor(226, 232, 240); // lineColor for border
                    doc.setLineWidth(0.1); // lineWidth for border
                    doc.line(x, y + height, x + width, y + height); // Draw bottom line
                  }
                },    margin: { left: margin, right: margin },
  });

  // 6. Final Verification Footer
  const finalY = (doc as any).lastAutoTable.finalY + 20;
  
  doc.setDrawColor(226, 232, 240);
  doc.line(margin, finalY, pageWidth - margin, finalY);
  
  doc.setFontSize(7);
  doc.setTextColor(148, 163, 184);
  doc.setFont("helvetica", "italic");
  doc.text("This document is an automated electronic statement generated by the Daily Expense System. No signature is required.", pageWidth / 2, finalY + 10, { align: "center" });
  doc.text(`Page 1 of 1  |  Reference ID: ${Math.random().toString(36).substring(7).toUpperCase()}`, pageWidth / 2, finalY + 15, { align: "center" });

  // Save the generated PDF
  const fileName = `${bankName.replace(/\s+/g, '_')}_Statement_${dayjs().format('YYYY-MM-DD')}.pdf`;
  doc.save(fileName);
};