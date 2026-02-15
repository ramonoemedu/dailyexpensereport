import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";

export const generatePdf = (data: any) => {
    const doc = new jsPDF();

    // Add the template content to the PDF
    doc.text("Your PDF Title", 10, 10);
    
    // Example of adding a table with data
    autoTable(doc, {
        head: [['Column 1', 'Column 2', 'Column 3']],
        body: data.map((item: any) => [item.col1, item.col2, item.col3]),
    });

    // Save the generated PDF
    doc.save("output.pdf");
};