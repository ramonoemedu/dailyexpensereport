/**
 * Import CMCB Excel bank statement → PostgreSQL
 *
 * Usage:
 *   node scripts/import-cmcb-xlsx.mjs <path-to-xlsx> [--dry-run]
 *
 * Requirements:
 *   - SSH tunnel open: ssh -L 5433:127.0.0.1:5433 ramonoem@188.166.181.131 -N
 *   - DATABASE_URL env var (or .env.local)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

// Load .env.local for DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  for (const envFile of ['.env.local', '.env.production']) {
    const envPath = path.join(ROOT, envFile);
    if (existsSync(envPath)) {
      const lines = readFileSync(envPath, 'utf8').split('\n');
      for (const line of lines) {
        const [key, ...rest] = line.split('=');
        if (key?.trim() === 'DATABASE_URL' && rest.length) {
          process.env.DATABASE_URL = rest.join('=').trim().replace(/^"|"$/g, '');
        }
      }
      if (process.env.DATABASE_URL) break;
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const xlsx = require('xlsx');

const FAMILY_ID = 'HfLedbulpkLaeFMXwkVK';
const PAYMENT_METHOD = 'Chip Mong Bank';

const MONTH_MAP = {
  JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06',
  JUL: '07', AUG: '08', SEP: '09', OCT: '10', NOV: '11', DEC: '12',
};

function parseCmcbDate(raw) {
  // "01-APR-26 12:51:07 AM" → "2026-04-01"
  const datePart = String(raw).split(' ')[0]; // "01-APR-26"
  const [day, mon, yr] = datePart.split('-');
  const month = MONTH_MAP[mon?.toUpperCase()] || '01';
  const year = yr?.length === 2 ? `20${yr}` : yr;
  return `${year}-${month}-${day?.padStart(2, '0')}`;
}

function parseAmount(v) {
  return parseFloat(String(v).replace(/,/g, '')) || 0;
}

function extractDescription(raw) {
  // First line before newline is the clean description
  const firstLine = String(raw).split('\n')[0].trim().replace(/,\s*$/, '');
  // Extract remark if present
  const remarkMatch = String(raw).match(/Remark:\s*(.+)/i);
  const remark = remarkMatch ? remarkMatch[1].trim() : '';
  if (remark && !firstLine.toLowerCase().includes(remark.toLowerCase())) {
    return `${firstLine} (${remark})`;
  }
  return firstLine || 'Bank Transaction';
}

function autoCategorize(desc) {
  const d = desc.toLowerCase();
  if (d.includes('salary') || d.includes('payroll')) return 'Salary';
  if (d.includes('interest')) return 'Interest';
  if (d.includes('tax')) return 'Tax';
  if (d.includes('coffee') || d.includes('cafe')) return 'Food & Dining';
  if (d.includes('food') || d.includes('restaurant') || d.includes('kfc') || d.includes('pizza')) return 'Food & Dining';
  if (d.includes('market') || d.includes('supermarket') || d.includes('grocery')) return 'Groceries';
  if (d.includes('fuel') || d.includes('caltex') || d.includes('petrol') || d.includes('gas station')) return 'Transport';
  if (d.includes('parking')) return 'Transport';
  if (d.includes('transfer') || d.includes('trf') || d.includes('receive from') || d.includes('paid to')) return 'Transfer';
  if (d.includes('atm') || d.includes('withdraw')) return 'Cash Withdrawal';
  if (d.includes('fee') || d.includes('charge')) return 'Fees';
  if (d.includes('electric') || d.includes('water') || d.includes('utility')) return 'Utilities';
  if (d.includes('phone') || d.includes('mobile') || d.includes('internet')) return 'Phone & Internet';
  if (d.includes('hospital') || d.includes('clinic') || d.includes('pharmacy')) return 'Healthcare';
  if (d.includes('school') || d.includes('tuition') || d.includes('education')) return 'Education';
  return 'Other';
}

async function main() {
  const DRY_RUN = process.argv.includes('--dry-run');
  const xlsxArg = process.argv.find(a => a.endsWith('.xlsx'));
  const xlsxPath = xlsxArg ? path.resolve(xlsxArg) : path.join(ROOT, 'CMCB_Account_Statement_01-Apr-26_07-May-26.xlsx');

  if (!existsSync(xlsxPath)) {
    console.error(`ERROR: File not found: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(DRY_RUN ? '🔍 DRY RUN — no writes\n' : '🚀 LIVE MODE — inserting to PostgreSQL\n');
  console.log(`File: ${path.basename(xlsxPath)}`);
  console.log(`Family: ${FAMILY_ID}\n`);

  // Parse Excel
  const wb = xlsx.readFile(xlsxPath);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = xlsx.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const transactions = [];
  for (const row of rows.slice(4)) {
    if (!row[0]) continue; // skip empty rows

    const date = parseCmcbDate(row[0]);
    if (!date || date === 'undefined-01-undefined') continue;

    const description = extractDescription(row[1]);
    const refNo = String(row[2]).trim();
    const currency = String(row[3]).trim() || 'USD';
    const moneyIn = parseAmount(row[4]);
    const moneyOut = parseAmount(row[5]);

    if (moneyIn === 0 && moneyOut === 0) continue;

    const isIncome = moneyIn > 0;
    const amount = isIncome ? moneyIn : moneyOut;

    transactions.push({
      date,
      description,
      refNo,
      currency,
      amount,
      type: isIncome ? 'Income' : 'Expense',
      category: autoCategorize(description),
    });
  }

  console.log(`Parsed ${transactions.length} transactions from Excel`);

  // Connect to DB
  const prisma = new PrismaClient();

  try {
    // Check if family exists
    const family = await prisma.family.findUnique({ where: { id: FAMILY_ID } });
    if (!family) {
      console.error(`ERROR: Family ${FAMILY_ID} not found in database.`);
      process.exit(1);
    }
    console.log(`Family found: ${family.name}`);

    // Get existing importRefs in this date range to avoid duplicates
    const dates = transactions.map(t => t.date).sort();
    const existing = await prisma.expense.findMany({
      where: {
        familyId: FAMILY_ID,
        date: { gte: dates[0], lte: dates[dates.length - 1] },
        paymentMethod: PAYMENT_METHOD,
      },
      select: { importRef: true, date: true, amount: true, type: true },
    });

    const existingRefs = new Set(existing.map(e => e.importRef).filter(Boolean));
    const existingKeys = new Set(existing.map(e => `${e.date}|${e.amount}|${e.type}`));

    console.log(`Existing CMCB records in range: ${existing.length}\n`);

    // Find new transactions
    const toInsert = transactions.filter(t => {
      if (t.refNo && existingRefs.has(t.refNo)) return false;
      if (existingKeys.has(`${t.date}|${t.amount}|${t.type}`)) return false;
      return true;
    });

    const skipped = transactions.length - toInsert.length;

    // Summary by month
    const byMonth = {};
    for (const t of toInsert) {
      const m = t.date.slice(0, 7);
      if (!byMonth[m]) byMonth[m] = { income: 0, expense: 0, count: 0 };
      if (t.type === 'Income') byMonth[m].income += t.amount;
      else byMonth[m].expense += t.amount;
      byMonth[m].count++;
    }

    console.log(`Skipped (already exists): ${skipped}`);
    console.log(`To insert: ${toInsert.length}`);
    for (const [m, s] of Object.entries(byMonth).sort()) {
      console.log(`  ${m}: ${s.count} txns  |  +$${s.income.toFixed(2)} income  |  -$${s.expense.toFixed(2)} expense`);
    }

    if (toInsert.length === 0) {
      console.log('\n✅ Already in sync — nothing to insert.');
      return;
    }

    if (DRY_RUN) {
      console.log('\n--- First 20 to insert ---');
      toInsert.slice(0, 20).forEach(t =>
        console.log(`  ${t.date}  ${t.type === 'Income' ? '+' : '-'}$${t.amount.toFixed(2)}  [${t.category}]  ${t.description.slice(0, 60)}`)
      );
      console.log('\nRun without --dry-run to insert.');
      return;
    }

    // Insert in chunks of 500
    const now = new Date();
    let inserted = 0;
    for (let i = 0; i < toInsert.length; i += 500) {
      const chunk = toInsert.slice(i, i + 500).map(t => ({
        familyId: FAMILY_ID,
        date: t.date,
        description: t.description,
        amount: t.amount,
        currency: t.currency,
        type: t.type,
        category: t.category,
        paymentMethod: PAYMENT_METHOD,
        status: 'active',
        importRef: t.refNo,
        extraData: {},
        createdAt: now,
        updatedAt: now,
      }));

      await prisma.expense.createMany({ data: chunk, skipDuplicates: true });
      inserted += chunk.length;
      console.log(`  Inserted ${inserted}/${toInsert.length}...`);
    }

    console.log(`\n✅ Done! Inserted ${inserted} new transactions.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(err => { console.error('Import failed:', err); process.exit(1); });
