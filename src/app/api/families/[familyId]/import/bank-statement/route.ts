import { NextRequest, NextResponse } from 'next/server';
import { verifyFamilyAccess } from '@/lib/verifyFamilyAccess';
import { getAdminDb } from '@/lib/firebaseAdmin';

export const runtime = 'nodejs';

const MONTH_MAP: Record<string, string> = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function parseCmcbDate(d: string): string {
  // "01-MAR-2026" → "2026-03-01"
  const parts = d.split('-');
  if (parts.length !== 3) return '';
  const [day, mon, year] = parts;
  return `${year}-${MONTH_MAP[mon] || '01'}-${day.padStart(2, '0')}`;
}

function parseAmount(s: string): number {
  return parseFloat(s.replace(/,/g, '')) || 0;
}

interface ParsedTransaction {
  date: string;
  description: string;
  moneyIn: number;
  moneyOut: number;
  balance: number;
  refNo: string;
  currency: string;
}

function parseCmcbStatement(rawText: string): ParsedTransaction[] {
  const results: ParsedTransaction[] = [];

  // Normalize whitespace
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Split into lines and find transaction blocks by date pattern
  const lines = text.split('\n');
  const DATE_RE = /^(\d{2}-[A-Z]{3}-\d{4})\s+(\d{2}:\d{2}:\d{2}\s*[AP]M)/;

  // Group lines into transaction blocks
  const blocks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (DATE_RE.test(line.trim())) {
      if (current.length) blocks.push(current);
      current = [line.trim()];
    } else if (current.length) {
      current.push(line.trim());
    }
  }
  if (current.length) blocks.push(current);

  for (const block of blocks) {
    if (!block.length) continue;
    const firstLine = block[0];
    const dateMatch = firstLine.match(/^(\d{2}-[A-Z]{3}-\d{4})\s+(\d{2}:\d{2}:\d{2}\s*[AP]M)\s*/);
    if (!dateMatch) continue;

    const date = parseCmcbDate(dateMatch[1]);
    if (!date) continue;

    const afterDateTime = firstLine.slice(dateMatch[0].length).trim();

    // Extract 3 amounts (MoneyIn MoneyOut Balance) from the end of the line
    // Numbers like: 0.08  0.00  152.10 or 1,234.56
    const amountRe = /([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;
    const amtMatch = afterDateTime.match(amountRe);
    if (!amtMatch) continue;

    const moneyIn = parseAmount(amtMatch[1]);
    const moneyOut = parseAmount(amtMatch[2]);
    const balance = parseAmount(amtMatch[3]);

    if (moneyIn === 0 && moneyOut === 0) continue;

    // Extract reference number
    const refRe = /\b(\d{3}[A-Z]{1,5}\d{8,}[A-Z0-9]*)\b/;
    const refMatch = afterDateTime.match(refRe);
    const refNo = refMatch ? refMatch[1] : '';

    // Description: text before the reference number (or before the amounts if no ref)
    let description = afterDateTime;
    if (refNo) description = description.slice(0, description.indexOf(refNo)).trim();
    else description = description.replace(amountRe, '').trim();
    description = description.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();

    // Fallback: use Remark line from block
    if (!description || description.length < 2) {
      for (const l of block) {
        const rm = l.match(/^Remark:\s*(.+)/i);
        if (rm) { description = rm[1].trim(); break; }
      }
    }

    // Enrich description with remark if present
    const remarkLine = block.find(l => /^Remark:/i.test(l));
    if (remarkLine) {
      const remark = remarkLine.replace(/^Remark:\s*/i, '').trim();
      if (remark && description && !description.toLowerCase().includes(remark.toLowerCase())) {
        description = `${description} (${remark})`;
      }
    }

    // Currency from "Original Amount: X KHR/USD"
    const origLine = block.find(l => /^Original Amount:/i.test(l));
    let currency = 'USD';
    if (origLine) {
      const cur = origLine.match(/(USD|KHR)\s*$/i);
      if (cur) currency = cur[1].toUpperCase();
    }

    results.push({
      date,
      description: description || 'Bank Transaction',
      moneyIn,
      moneyOut,
      balance,
      refNo,
      currency,
    });
  }

  return results;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ familyId: string }> }
) {
  try {
    const { familyId } = await params;
    await verifyFamilyAccess(req, familyId);

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 });

    const arrayBuffer = await file.arrayBuffer();
    const buffer = new Uint8Array(arrayBuffer);

    // Parse PDF using pdfjs-dist legacy (no worker needed server-side)
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs' as any);
    const lib = (pdfjs as any).default ?? pdfjs;
    if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = '';

    const pdf = await lib.getDocument({ data: buffer }).promise;
    let fullText = '';

    for (let p = 1; p <= pdf.numPages; p++) {
      const page = await pdf.getPage(p);
      const content = await page.getTextContent();

      // Group text items by y-position to reconstruct lines
      const yGroups: Map<number, Array<{ x: number; str: string }>> = new Map();
      for (const item of content.items as any[]) {
        if (!item.str?.trim()) continue;
        const y = Math.round(item.transform[5]);
        if (!yGroups.has(y)) yGroups.set(y, []);
        yGroups.get(y)!.push({ x: item.transform[4], str: item.str });
      }

      // Sort lines top→bottom, items left→right
      const sortedLines = [...yGroups.entries()]
        .sort((a, b) => b[0] - a[0])
        .map(([, items]) =>
          items.sort((a, b) => a.x - b.x).map(i => i.str).join(' ')
        );

      fullText += sortedLines.join('\n') + '\n';
    }

    const parsed = parseCmcbStatement(fullText);

    // Detect duplicates: check existing expenses for same date+amount+type
    const db = getAdminDb();
    const dates = [...new Set(parsed.map(t => t.date))];
    const existingKeys = new Set<string>();

    await Promise.all(
      dates.map(async date => {
        const snap = await db
          .collection('families').doc(familyId)
          .collection('expenses')
          .where('Date', '==', date)
          .get();
        snap.docs.forEach(d => {
          const data = d.data();
          const amt = Math.abs(Number(data.Amount || 0));
          const type = data.Type || 'Expense';
          existingKeys.add(`${data.Date}|${amt}|${type}`);
        });
      })
    );

    const transactions = parsed.map((t, idx) => {
      const isIncome = t.moneyIn > 0;
      const amount = isIncome ? t.moneyIn : t.moneyOut;
      const key = `${t.date}|${amount}|${isIncome ? 'Income' : 'Expense'}`;
      return {
        id: `import_${idx}`,
        date: t.date,
        description: t.description,
        amount,
        type: isIncome ? 'Income' : 'Expense',
        currency: t.currency,
        moneyIn: t.moneyIn,
        moneyOut: t.moneyOut,
        balance: t.balance,
        refNo: t.refNo,
        isDuplicate: existingKeys.has(key),
      };
    });

    return NextResponse.json({ transactions, totalParsed: transactions.length });
  } catch (err: any) {
    console.error('[import/bank-statement]', err);
    return NextResponse.json({ error: err?.message || 'Parse failed' }, { status: 500 });
  }
}
