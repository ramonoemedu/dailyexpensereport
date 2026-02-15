import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';

export const generateWordFromMarkdown = async (markdown: string): Promise<Blob> => {
    const lines = markdown.split('\n');
    const children: Paragraph[] = [];

    for (const line of lines) {
        // Remove trailing whitespace
        const trimmedLine = line.replace(/\s+$/, '');

        if (!trimmedLine) {
            children.push(new Paragraph({}));
            continue;
        }

        if (trimmedLine.startsWith('# ')) {
            children.push(new Paragraph({
                heading: HeadingLevel.HEADING_1,
                alignment: AlignmentType.CENTER,
                children: [
                    new TextRun({
                        text: trimmedLine.substring(2),
                        bold: true,
                        size: 32, // 16pt
                    })
                ]
            }));
        } else if (trimmedLine.startsWith('## ')) {
            children.push(new Paragraph({
                heading: HeadingLevel.HEADING_2,
                children: [
                    new TextRun({
                        text: trimmedLine.substring(3),
                        bold: true,
                        size: 24, // 12pt
                    })
                ]
            }));
        } else if (trimmedLine.startsWith('### ')) {
            children.push(new Paragraph({
                heading: HeadingLevel.HEADING_3,
                children: [
                    new TextRun({
                        text: trimmedLine.substring(4),
                        bold: true,
                        size: 22, // 11pt
                    })
                ]
            }));
        } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('+ ') || trimmedLine.startsWith('* ')) {
            children.push(new Paragraph({
                text: trimmedLine.substring(2),
                bullet: {
                    level: 0
                }
            }));
        } else {
            children.push(new Paragraph({
                text: trimmedLine
            }));
        }
    }

    const doc = new Document({
        sections: [
            {
                children: children,
            },
        ],
    });

    return await Packer.toBlob(doc);
};

export const generateWordFromHTML = async (html: string): Promise<Blob> => {
    // Parse HTML into simple paragraphs/headings and build Word document
    const parser = new DOMParser();
    const docHtml = parser.parseFromString(html, 'text/html');
    const children: Paragraph[] = [];

    docHtml.body.childNodes.forEach((node: any) => {
        if (node.nodeType === Node.ELEMENT_NODE) {
            const tag = node.tagName.toUpperCase();
            const text = node.textContent || '';
            if (tag === 'H1') {
                children.push(new Paragraph({
                    heading: HeadingLevel.HEADING_1,
                    children: [new TextRun({ text, bold: true, size: 32 })]
                }));
            } else if (tag === 'H2') {
                children.push(new Paragraph({
                    heading: HeadingLevel.HEADING_2,
                    children: [new TextRun({ text, bold: true, size: 24 })]
                }));
            } else if (tag === 'UL' || tag === 'OL') {
                node.childNodes.forEach((li: any) => {
                    if (li.nodeType === Node.ELEMENT_NODE && li.tagName.toUpperCase() === 'LI') {
                        children.push(new Paragraph({ text: li.textContent || '', bullet: { level: 0 } }));
                    }
                });
            } else {
                children.push(new Paragraph({ text }));
            }
        } else if (node.nodeType === Node.TEXT_NODE) {
            const text = node.textContent?.trim();
            if (text) children.push(new Paragraph({ text }));
        }
    });

    const doc = new Document({ sections: [{ children }] });
    return await Packer.toBlob(doc);
};