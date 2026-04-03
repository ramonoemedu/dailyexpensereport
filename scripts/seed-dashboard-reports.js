/**
 * Seed pre-computed dashboard report docs for all existing expenses.
 * Usage: node scripts/seed-dashboard-reports.js
 *
 * Writes to: families/{familyId}/reports/dashboard_{year}
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Credentials ───────────────────────────────────────────────────────────────
// Change to serviceAccountKey.json for dev
const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKeyProd.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌  serviceAccountKeyProd.json not found at project root.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

// ── autoCategorize (mirrors src/utils/DescriptionHelper.ts) ──────────────────
function autoCategorize(description, currentCategory) {
  const generic = ['Uncategorized', 'General/Other', 'Other', '', 'N/A'];
  if (currentCategory && !generic.includes(currentCategory)) return currentCategory;
  const desc = (description || '').toLowerCase();
  if (['café','coffee','lunch','dinner','food','restaurant','drink','matcha','coconut','bread','water','ice cream','burger','pizza','kfc','meat','vegetable','fruit','bakery','noodle','starbuck','soup','oyster','coke','coca','beer','wisky','wine'].some(k => desc.includes(k))) return 'Food & Drinks';
  if (['gasoline','fuel','taxi','grab','car','hometown','tuktuk','passapp','parking','moto','bus','trip','caltex','totalenerg','tela','ptt'].some(k => desc.includes(k))) return 'Transportation';
  if (['electricity','edc','water bill','internet','phone','top up','mobile data','cellcard','smart','metfone','refill','wifi'].some(k => desc.includes(k))) return 'Utilities';
  if (['health','hospital','doctor','medichine','medicine','pharmacy','dentist','teeth','sick','clinic','vitamin','supplement'].some(k => desc.includes(k))) return 'Health';
  if (['mak','pa','pha','hea','jee','send to','family','support','parent','wife','husband','child','baby','diaper','milk powder'].some(k => desc.includes(k))) return 'Family';
  if (['clothes','shoes','electronic','iphone','gadget','mall','shopping','dress','skirt','shirt','watch','lipstick','makeup','make up','skincare','shampoo','soap','nail','cream','aeon','lucky express','mart'].some(k => desc.includes(k))) return 'Shopping';
  if (['movie','cinema','game','netflix','concert','party','holiday','vacation','hotel','resort'].some(k => desc.includes(k))) return 'Entertainment';
  if (['school','university','course','book','training','tuition'].some(k => desc.includes(k))) return 'Education';
  if (['invest','stock','crypto','property','gold','saving'].some(k => desc.includes(k))) return 'Investment';
  if (['gift','donation','present','wedding','charity','tip'].some(k => desc.includes(k))) return 'Gift & Donation';
  return 'Other';
}

// ── Compute stats for one month's docs ───────────────────────────────────────
function computeStats(docs, includeInactive) {
  const today = new Date().toISOString().split('T')[0];
  let income = 0, incomeWithFuture = 0, expense = 0;
  let bankIncome = 0, bankExpense = 0, cashIncome = 0, cashExpense = 0;
  const categoryTotals = {};
  const incomeItems = [];
  let transactionCount = 0;

  docs.forEach(d => {
    const data = d.data();
    if (!includeInactive && (data.status || 'active') !== 'active') return;

    const amount = Math.abs(Number(data.Amount || data.amount || 0));
    if (!amount) return;

    const isIncome = (data.Type || data.type || 'Expense') === 'Income';
    const dateStr = String(data.Date || '');
    const isFuture = !!dateStr && dateStr > today;
    const method = (data['Payment Method'] || data['Payment_Method'] || '').toLowerCase();
    const currency = data.Currency || 'USD';
    if (currency !== 'USD') return;

    if (!isFuture) {
      if (method.includes('cash')) {
        if (isIncome) cashIncome += amount; else cashExpense += amount;
      } else {
        if (isIncome) bankIncome += amount; else bankExpense += amount;
      }
    }

    if (isIncome) {
      incomeWithFuture += amount;
      incomeItems.push({ date: dateStr, description: data.Description || data.description || 'Income', amount, isFuture });
      if (!isFuture) income += amount;
    } else if (!isFuture) {
      expense += amount;
      transactionCount++;
      const cat = autoCategorize(data.Description || data.description || '', data.Category || data.category);
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amount;
    }
  });

  incomeItems.sort((a, b) => a.date.localeCompare(b.date));
  const sortedCategories = Object.entries(categoryTotals)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value: parseFloat(value.toFixed(2)) }));

  const r = n => parseFloat(n.toFixed(2));
  return {
    income: r(income), incomeWithFuture: r(incomeWithFuture), expense: r(expense),
    bankIncome: r(bankIncome), bankExpense: r(bankExpense),
    cashIncome: r(cashIncome), cashExpense: r(cashExpense),
    categoryTotals, sortedCategories,
    topCategory: sortedCategories[0]?.name || 'None',
    incomeItems, transactionCount,
  };
}

// ── Rebuild one month ─────────────────────────────────────────────────────────
async function rebuildMonthReport(familyId, year, month) {
  const mm = String(month + 1).padStart(2, '0');
  const monthStart = `${year}-${mm}-01`;
  const monthEnd  = `${year}-${mm}-${String(new Date(year, month + 1, 0).getDate()).padStart(2, '0')}`;

  const snap = await db
    .collection('families').doc(familyId)
    .collection('expenses')
    .where('Date', '>=', monthStart)
    .where('Date', '<=', monthEnd)
    .get();

  const active = computeStats(snap.docs, false);
  const all    = computeStats(snap.docs, true);

  const docRef = db.collection('families').doc(familyId).collection('reports').doc(`dashboard_${year}`);
  await docRef.set(
    { months: { [month]: { active, all } }, lastUpdated: new Date().toISOString() },
    { mergeFields: [new admin.firestore.FieldPath('months', String(month)), 'lastUpdated'] }
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  console.log('🔍  Scanning families...');
  const familiesSnap = await db.collection('families').get();
  console.log(`📁  Found ${familiesSnap.size} family(ies)\n`);

  let totalMonths = 0;

  for (const familyDoc of familiesSnap.docs) {
    const familyId = familyDoc.id;
    const familyName = familyDoc.data().name || familyId;
    console.log(`👨‍👩‍👧  Family: ${familyName} (${familyId})`);

    // Fetch only the Date field to find which year/months have data
    const expSnap = await db
      .collection('families').doc(familyId)
      .collection('expenses')
      .select('Date')
      .get();

    if (expSnap.empty) {
      console.log('   ⚠️  No expenses found, skipping.\n');
      continue;
    }

    // Collect unique year/month combos
    const monthKeys = new Set();
    expSnap.docs.forEach(d => {
      const dateStr = String(d.data().Date || '');
      if (!dateStr) return;
      const parsed = new Date(dateStr);
      if (!isNaN(parsed.getTime())) {
        monthKeys.add(`${parsed.getFullYear()}:${parsed.getMonth()}`);
      }
    });

    console.log(`   📊  ${expSnap.size} expenses across ${monthKeys.size} month(s)`);

    const sorted = [...monthKeys].sort();
    for (const key of sorted) {
      const [year, month] = key.split(':').map(Number);
      const label = `${year}-${String(month + 1).padStart(2, '0')}`;
      process.stdout.write(`   ⚙️  Building ${label}...`);
      try {
        await rebuildMonthReport(familyId, year, month);
        process.stdout.write(' ✅\n');
        totalMonths++;
      } catch (err) {
        process.stdout.write(` ❌  ${err.message}\n`);
      }
    }
    console.log();
  }

  console.log(`✅  Done. Rebuilt ${totalMonths} month report(s) across ${familiesSnap.size} family(ies).`);
  process.exit(0);
}

main().catch(err => {
  console.error('❌  Fatal error:', err);
  process.exit(1);
});
