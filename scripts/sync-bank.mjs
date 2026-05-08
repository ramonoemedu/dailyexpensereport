// sync-bank.mjs — parse CMCB PDF, compare with Firestore, insert missing transactions
import { readFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// ── Firebase init ──────────────────────────────────────────────────────────
const sak = JSON.parse(readFileSync(path.join(ROOT, 'serviceAccountKey.json'), 'utf8'));
initializeApp({ credential: cert(sak) });
const db = getFirestore();
const FAMILY_ID = 'HfLedbulpkLaeFMXwkVK';

// ── PDF parse (same logic as route.ts) ────────────────────────────────────
const MONTH_MAP = {
  JAN:'01',FEB:'02',MAR:'03',APR:'04',MAY:'05',JUN:'06',
  JUL:'07',AUG:'08',SEP:'09',OCT:'10',NOV:'11',DEC:'12',
};
function parseCmcbDate(d) {
  const parts = d.split('-');
  if (parts.length !== 3) return '';
  const [day, mon, year] = parts;
  return `${year}-${MONTH_MAP[mon] || '01'}-${day.padStart(2,'0')}`;
}
function parseAmount(s) { return parseFloat(String(s).replace(/,/g,'')) || 0; }

function parseCmcbStatement(rawText) {
  const results = [];
  const text = rawText.replace(/\r\n/g,'\n').replace(/\r/g,'\n');
  const lines = text.split('\n').map(l => l.trim()).filter(Boolean);

  // Transaction header line: starts with DD-MMM-YYYY and ends with 3 decimal amounts
  const TX_RE = /^(\d{2}-[A-Z]{3}-\d{4})\s+(.*?)\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s*$/;

  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(TX_RE);
    if (!m) continue;

    const date = parseCmcbDate(m[1]);
    if (!date) continue;

    const middle = m[2].trim(); // between date and amounts
    const moneyIn = parseAmount(m[3]);
    const moneyOut = parseAmount(m[4]);
    const balance = parseAmount(m[5]);
    if (moneyIn === 0 && moneyOut === 0) continue;

    // Extract ref number from middle section
    const refRe = /\b(\d{3}[A-Z]{1,5}\d{8,}[A-Z0-9]*)\b/;
    const refMatch = middle.match(refRe);
    const refNo = refMatch ? refMatch[1] : '';

    // Description: part of middle before refNo
    let description = refNo ? middle.slice(0, middle.indexOf(refNo)).trim() : middle.trim();
    description = description.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();

    // If no inline desc, use the line immediately before (e.g. "Paid to NAME,")
    if (!description || description.length < 2) {
      for (let back = i - 1; back >= Math.max(0, i - 3); back--) {
        const prev = lines[back];
        if (/^\d{2}-[A-Z]{3}-\d{4}/.test(prev)) break; // hit another tx
        if (prev && !prev.startsWith('Original Amount') && !prev.startsWith('Remark') &&
            !prev.startsWith('Bank:') && !prev.startsWith('Transaction Hash') &&
            !/^\d{2}:\d{2}:\d{2}/.test(prev) && !/^From:/i.test(prev)) {
          description = prev.replace(/,\s*$/, '').replace(/\s+/g, ' ').trim();
          break;
        }
      }
    }

    // Look ahead for Remark and Original Amount (within next 15 lines until next tx)
    let currency = 'USD';
    let remark = '';
    for (let j = i + 1; j < Math.min(lines.length, i + 20); j++) {
      if (/^\d{2}-[A-Z]{3}-\d{4}/.test(lines[j])) break;
      const orig = lines[j].match(/^Original Amount:\s*[\d.,]+\s*(USD|KHR)/i);
      if (orig) currency = orig[1].toUpperCase();
      const rm = lines[j].match(/^Remark:\s*(.+)/i);
      if (rm) remark = rm[1].trim();
    }

    if (remark && description && !description.toLowerCase().includes(remark.toLowerCase())) {
      description = `${description} (${remark})`;
    }

    results.push({
      date,
      description: description || 'Bank Transaction',
      moneyIn, moneyOut, balance, refNo, currency
    });
  }
  return results;
}

// ── Auto-categorize (simple version) ──────────────────────────────────────
function autoCategorize(desc) {
  const d = desc.toLowerCase();
  if (d.includes('salary') || d.includes('payroll')) return 'Salary';
  if (d.includes('food') || d.includes('restaurant') || d.includes('cafe') || d.includes('coffee')) return 'Food & Dining';
  if (d.includes('market') || d.includes('supermarket') || d.includes('grocery')) return 'Groceries';
  if (d.includes('transfer') || d.includes('trf')) return 'Transfer';
  if (d.includes('atm') || d.includes('withdraw')) return 'Cash Withdrawal';
  if (d.includes('fee') || d.includes('charge')) return 'Fees';
  if (d.includes('electric') || d.includes('water') || d.includes('utility')) return 'Utilities';
  if (d.includes('phone') || d.includes('mobile') || d.includes('internet')) return 'Phone & Internet';
  if (d.includes('hospital') || d.includes('clinic') || d.includes('pharmacy')) return 'Healthcare';
  if (d.includes('school') || d.includes('tuition') || d.includes('education')) return 'Education';
  return 'Other';
}

// ── Main ───────────────────────────────────────────────────────────────────
async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  console.log(DRY_RUN ? '🔍 DRY RUN — no writes will happen\n' : '🚀 LIVE MODE — will insert missing transactions\n');

  // 1. Parse PDF
  const pdfPath = path.join(ROOT, 'public/assets/CMCB_Account_Statement_01-Mar-26_07-May-26.pdf');
  const pdfBuffer = readFileSync(pdfPath);
  const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
  const lib = pdfjs.default ?? pdfjs;
  // Point workerSrc to the bundled worker file so pdfjs can load it
  const workerPath = new URL('../node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs', import.meta.url).href;
  if (lib.GlobalWorkerOptions) lib.GlobalWorkerOptions.workerSrc = workerPath;

  const pdf = await lib.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  let fullText = '';
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p);
    const content = await page.getTextContent();
    const yGroups = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5]);
      if (!yGroups.has(y)) yGroups.set(y, []);
      yGroups.get(y).push({ x: item.transform[4], str: item.str });
    }
    const sortedLines = [...yGroups.entries()]
      .sort((a,b) => b[0]-a[0])
      .map(([,items]) => items.sort((a,b) => a.x-b.x).map(i => i.str).join(' '));
    fullText += sortedLines.join('\n') + '\n';
  }

  const parsed = parseCmcbStatement(fullText);
  console.log(`PDF parsed: ${parsed.length} transactions total\n`);

  // 2. Get date range from PDF
  const dates = [...new Set(parsed.map(t => t.date))];
  const minDate = dates.sort()[0];
  const maxDate = dates.sort().slice(-1)[0];
  console.log(`Date range: ${minDate} → ${maxDate}`);

  // 3. Query existing Chip Mong Bank expenses in Firestore
  const expSnap = await db.collection('families').doc(FAMILY_ID).collection('expenses')
    .where('Date', '>=', minDate)
    .where('Date', '<=', maxDate)
    .get();

  const existingKeys = new Set();
  const existingByRef = new Set();
  expSnap.docs.forEach(d => {
    const data = d.data();
    // Only skip checking against non-bank entries to avoid false duplicate matches
    const method = (data['Payment Method'] || '').toLowerCase();
    if (!method.includes('chip mong') && !method.includes('chipmong')) return;
    const amt = Math.abs(Number(data.Amount || 0));
    existingKeys.add(`${data.Date}|${amt}|${data.Type}`);
    if (data.importRef) existingByRef.add(data.importRef);
  });

  console.log(`Firestore: ${expSnap.docs.length} docs in range, ${existingKeys.size} Chip Mong entries\n`);

  // 4. Find missing
  const missing = [];
  for (const t of parsed) {
    // include all currencies — bank amounts are already in USD equivalent
    const isIncome = t.moneyIn > 0;
    const amount = isIncome ? t.moneyIn : t.moneyOut;
    const type = isIncome ? 'Income' : 'Expense';
    const key = `${t.date}|${amount}|${type}`;
    if (existingKeys.has(key)) continue;
    if (t.refNo && existingByRef.has(t.refNo)) continue;
    missing.push({ ...t, amount, type });
  }

  console.log(`Missing transactions: ${missing.length}`);

  // Group by month for summary
  const byMonth = {};
  for (const t of missing) {
    const m = t.date.slice(0, 7);
    if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0, count: 0 };
    if (t.type === 'Income') byMonth[m].income += t.amount;
    else byMonth[m].expense += t.amount;
    byMonth[m].count++;
  }
  for (const [m, s] of Object.entries(byMonth).sort()) {
    console.log(`  ${m}: ${s.count} txns  |  +$${s.income.toFixed(2)} income  |  -$${s.expense.toFixed(2)} expense`);
  }

  if (missing.length === 0) {
    console.log('\n✅ System is already in sync with the bank statement!');
    return;
  }

  if (DRY_RUN) {
    console.log('\n--- First 20 missing ---');
    missing.slice(0, 20).forEach(t =>
      console.log(`  ${t.date}  ${t.type === 'Income' ? '+' : '-'}$${t.amount.toFixed(2)}  ${t.description.slice(0,60)}`)
    );
    console.log('\nRun without --dry-run to insert them.');
    return;
  }

  // 5. Insert in batches
  const now = new Date().toISOString();
  const affectedMonths = new Set();
  const chunks = [];
  for (let i = 0; i < missing.length; i += 400) chunks.push(missing.slice(i, i+400));

  let total = 0;
  for (const chunk of chunks) {
    const batch = db.batch();
    for (const t of chunk) {
      const ref = db.collection('families').doc(FAMILY_ID).collection('expenses').doc();
      batch.set(ref, {
        Date: t.date,
        Description: t.description,
        Amount: t.amount,
        Type: t.type,
        Currency: 'USD', // bank amounts are already USD-equivalent even for KHR transactions
        'Payment Method': 'Chip Mong Bank',
        Category: autoCategorize(t.description),
        status: 'active',
        createdAt: now,
        importRef: t.refNo || '',
      });
      const d = new Date(t.date);
      affectedMonths.add(`${d.getFullYear()}:${d.getMonth()}`);
      total++;
    }
    await batch.commit();
    console.log(`  Inserted chunk of ${chunk.length}`);
  }

  console.log(`\n✅ Inserted ${total} missing transactions.`);
  console.log(`Affected months: ${[...affectedMonths].sort().join(', ')}`);
  console.log('\nNote: Run a report rebuild to update cached stats (or visit the bank report page with ?rebuild=true)');
}

main().catch(err => { console.error(err); process.exit(1); });
