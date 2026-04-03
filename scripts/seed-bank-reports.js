/**
 * Seed pre-computed bank report docs for all existing expenses.
 * Usage: node scripts/seed-bank-reports.js
 *
 * Writes to: families/{familyId}/reports/bank_{bankId}_{year}
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKeyProd.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌  serviceAccountKeyProd.json not found.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

const BANKS = [{ id: 'chip-mong', name: 'Chip Mong Bank' }];

const BANK_ALIASES = {
  'chip-mong': ['chip mong bank', 'from chipmong bank to acaleda', 'chip mong bank'],
  'acleda':    ['acleda bank', 'from chipmong bank to acaleda'],
};

function matchesBank(method, bankId) {
  const m = method.toLowerCase();
  const aliases = BANK_ALIASES[bankId] || [bankId.toLowerCase()];
  return aliases.some(a => m.includes(a) || a.includes(m));
}

function autoCategorize(description, currentCategory) {
  const generic = ['Uncategorized', 'General/Other', 'Other', '', 'N/A'];
  if (currentCategory && !generic.includes(currentCategory)) return currentCategory;
  const desc = (description || '').toLowerCase();
  if (['café','coffee','lunch','dinner','food','restaurant','drink','matcha','bread','water','burger','pizza','kfc','meat','vegetable','fruit','bakery','noodle','starbuck','soup','beer','wine'].some(k => desc.includes(k))) return 'Food & Drinks';
  if (['gasoline','fuel','taxi','grab','car','tuktuk','passapp','parking','moto','bus','trip','caltex','ptt'].some(k => desc.includes(k))) return 'Transportation';
  if (['electricity','edc','water bill','internet','phone','top up','mobile data','cellcard','smart','metfone','wifi'].some(k => desc.includes(k))) return 'Utilities';
  if (['health','hospital','doctor','medicine','pharmacy','dentist','clinic','vitamin'].some(k => desc.includes(k))) return 'Health';
  if (['family','support','parent','wife','husband','child','baby','diaper','send to'].some(k => desc.includes(k))) return 'Family';
  if (['clothes','shoes','electronic','iphone','shopping','mall','aeon','mart'].some(k => desc.includes(k))) return 'Shopping';
  if (['movie','cinema','game','netflix','concert','party','holiday','hotel'].some(k => desc.includes(k))) return 'Entertainment';
  if (['school','university','course','book','training','tuition'].some(k => desc.includes(k))) return 'Education';
  if (['invest','stock','crypto','gold','saving'].some(k => desc.includes(k))) return 'Investment';
  if (['gift','donation','wedding','charity','tip'].some(k => desc.includes(k))) return 'Gift & Donation';
  return 'Other';
}

async function rebuildBankReport(familyId, bankId, year, month, configData) {
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;
  const today = new Date().toISOString().split('T')[0];

  const expSnap = await db
    .collection('families').doc(familyId)
    .collection('expenses')
    .where('Date', '>=', monthStart)
    .where('Date', '<=', monthEnd)
    .get();

  const transactions = expSnap.docs
    .filter(d => {
      const method = d.data()['Payment Method'] || d.data()['Payment_Method'] || '';
      return matchesBank(method, bankId);
    })
    .map(d => {
      const data = d.data();
      const amount = Math.abs(Number(data.Amount || data.amount || 0));
      const dateStr = String(data.Date || '');
      return {
        id: d.id,
        Date: dateStr,
        Description: data.Description || data.description || '',
        Category: autoCategorize(data.Description || data.description || '', data.Category || data.category),
        Amount: amount,
        Type: data.Type || data.type || 'Expense',
        'Payment Method': data['Payment Method'] || data['Payment_Method'] || '',
        Currency: data.Currency || 'USD',
        status: data.status || 'active',
        isFuture: !!dateStr && dateStr > today,
      };
    })
    .sort((a, b) => a.Date.localeCompare(b.Date));

  // Starting balance from config
  const targetTime = year * 12 + month;
  const bankBalances = (Array.isArray(configData?.balances) ? configData.balances : [])
    .filter(b => b.bankId === bankId)
    .map(b => ({ year: Number(b.year), month: Number(b.month), amount: Number(b.amount || 0) }))
    .filter(b => Number.isFinite(b.year) && Number.isFinite(b.month))
    .sort((a, b) => (a.year * 12 + a.month) - (b.year * 12 + b.month));
  const anchor = [...bankBalances].reverse().find(r => r.year * 12 + r.month <= targetTime);
  const startingBalance = anchor?.amount || 0;

  const docRef = db.collection('families').doc(familyId)
    .collection('reports').doc(`bank_${bankId}_${year}`);

  await docRef.set(
    { months: { [month]: { transactions, startingBalance } }, lastUpdated: new Date().toISOString() },
    { mergeFields: [new admin.firestore.FieldPath('months', String(month)), 'lastUpdated'] }
  );
}

async function main() {
  console.log('🔍  Scanning families...');
  const familiesSnap = await db.collection('families').get();
  console.log(`📁  Found ${familiesSnap.size} family(ies)\n`);

  let totalMonths = 0;

  for (const familyDoc of familiesSnap.docs) {
    const familyId = familyDoc.id;
    const familyName = familyDoc.data().name || familyId;

    const configSnap = await db.collection('families').doc(familyId)
      .collection('settings').doc('config').get();
    const configData = configSnap.exists ? configSnap.data() : {};

    const expSnap = await db.collection('families').doc(familyId)
      .collection('expenses').select('Date').get();

    if (expSnap.empty) {
      console.log(`👨‍👩‍👧  Family: ${familyName} — no expenses, skipping.\n`);
      continue;
    }

    const monthKeys = new Set();
    expSnap.docs.forEach(d => {
      const dateStr = String(d.data().Date || '');
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) monthKeys.add(`${parsed.getFullYear()}:${parsed.getMonth()}`);
    });

    for (const bank of BANKS) {
      console.log(`👨‍👩‍👧  Family: ${familyName} | Bank: ${bank.name}`);
      console.log(`   📊  ${monthKeys.size} month(s) to process`);
      for (const key of [...monthKeys].sort()) {
        const [year, month] = key.split(':').map(Number);
        const label = `${year}-${String(month + 1).padStart(2, '0')}`;
        process.stdout.write(`   ⚙️  Building ${label}...`);
        try {
          await rebuildBankReport(familyId, bank.id, year, month, configData);
          process.stdout.write(' ✅\n');
          totalMonths++;
        } catch (err) {
          process.stdout.write(` ❌  ${err.message}\n`);
        }
      }
      console.log();
    }
  }

  console.log(`✅  Done. Rebuilt ${totalMonths} bank month report(s).`);
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
