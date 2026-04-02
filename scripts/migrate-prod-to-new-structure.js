/**
 * Migrate Production DB → new family-scoped structure
 *
 * What this does:
 *  1. Creates /families/HfLedbulpkLaeFMXwkVK  (family doc)
 *  2. Updates system_users → adds families map + uid-keyed docs
 *  3. Copies /expenses → /families/{familyId}/expenses  (688 docs, preserve IDs)
 *  4. Migrates /settings → /families/{familyId}/settings/config  (balances + expenseTypes)
 *  5. Copies /income_configs → /families/{familyId}/income-configs  (preserve IDs)
 *
 * Usage: node scripts/migrate-prod-to-new-structure.js
 */

const admin = require('firebase-admin');
const path  = require('path');

const FAMILY_ID   = 'HfLedbulpkLaeFMXwkVK';
const FAMILY_NAME = 'My Family';
const BATCH_SIZE  = 400;

// ── Init ──────────────────────────────────────────────────────────────────────
const key = require(path.join(__dirname, '..', 'serviceAccountKeyProd.json'));
admin.initializeApp({ credential: admin.credential.cert(key) });
const db = admin.firestore();

// ── Helpers ───────────────────────────────────────────────────────────────────
async function batchWrite(operations) {
  for (let i = 0; i < operations.length; i += BATCH_SIZE) {
    const chunk = operations.slice(i, i + BATCH_SIZE);
    const batch = db.batch();
    chunk.forEach(({ ref, data }) => batch.set(ref, data, { merge: true }));
    await batch.commit();
    console.log(`   wrote ${Math.min(i + BATCH_SIZE, operations.length)} / ${operations.length}`);
  }
}

async function main() {
  console.log('\n🚀  Starting production migration\n');

  // ── 1. Create family doc ───────────────────────────────────────────────────
  console.log('1️⃣   Creating family doc...');
  await db.collection('families').doc(FAMILY_ID).set({
    name: FAMILY_NAME,
    status: 'active',
    createdAt: new Date().toISOString(),
  }, { merge: true });
  console.log(`   ✓ /families/${FAMILY_ID}\n`);

  // ── 2. Update system_users ─────────────────────────────────────────────────
  console.log('2️⃣   Updating system_users...');
  const usersSnap = await db.collection('system_users').get();

  // ramonoem → admin, vatsopheap → member (change here if needed)
  const roleMap = {
    'uGGXOe4cs2OgsBX93ZkhpVXCwB72': 'admin',   // ramonoem
    '8rITQLZO6scFM9sj14bPzp6wQD23': 'member',  // vatsopheap
  };

  for (const userDoc of usersSnap.docs) {
    const data = userDoc.data();
    const uid  = data.uid;
    const role = roleMap[uid] || 'member';

    const update = { families: { [FAMILY_ID]: role }, uid };

    // Update existing doc (may be random-ID doc)
    await db.collection('system_users').doc(userDoc.id).set(update, { merge: true });

    // Also ensure uid-keyed doc exists (required by verifyFamilyAccess fast path)
    if (userDoc.id !== uid) {
      await db.collection('system_users').doc(uid).set({ ...data, ...update }, { merge: true });
      console.log(`   ✓ ${data.username} — updated legacy doc + created uid-keyed doc (role: ${role})`);
    } else {
      console.log(`   ✓ ${data.username} — updated (role: ${role})`);
    }
  }
  console.log();

  // ── 3. Copy expenses ───────────────────────────────────────────────────────
  console.log('3️⃣   Copying expenses...');
  const expSnap = await db.collection('expenses').get();
  const expOps  = expSnap.docs.map(d => ({
    ref:  db.collection('families').doc(FAMILY_ID).collection('expenses').doc(d.id),
    data: d.data(),
  }));
  await batchWrite(expOps);
  console.log(`   ✓ ${expOps.length} expenses copied\n`);

  // ── 4. Migrate settings → config doc ──────────────────────────────────────
  console.log('4️⃣   Migrating settings...');
  const settingsSnap = await db.collection('settings').get();

  const balances     = [];
  const cashBalances = [];
  let   expenseTypes = [];

  settingsSnap.docs.forEach(d => {
    const id   = d.id;
    const data = d.data();

    if (id === 'expenseTypes') {
      expenseTypes = data.types || [];
      return;
    }

    // balance_chip-mong_2026_1  or  balance_2026_1
    const bankMatch = id.match(/^balance_(.+)_(\d{4})_(\d+)$/);
    const noBank    = id.match(/^balance_(\d{4})_(\d+)$/);

    if (bankMatch) {
      const [, bankId, year, month] = bankMatch;
      // skip generic (non-bank) duplicates — keep bank-keyed ones
      if (!['2026', '2025', '2024'].includes(bankId)) {
        balances.push({ bankId, year: Number(year), month: Number(month), amount: Number(data.amount || 0) });
      }
    } else if (noBank) {
      const [, year, month] = noBank;
      // Generic balance — use as chip-mong if no chip-mong entry exists
      balances.push({ bankId: 'chip-mong', year: Number(year), month: Number(month), amount: Number(data.amount || 0) });
    }
  });

  // Deduplicate balances (bank-keyed wins over generic)
  const balanceMap = new Map();
  balances.forEach(b => {
    const k = `${b.bankId}_${b.year}_${b.month}`;
    balanceMap.set(k, b);
  });
  const dedupedBalances = [...balanceMap.values()];

  await db.collection('families').doc(FAMILY_ID).collection('settings').doc('config').set({
    balances:     dedupedBalances,
    cashBalances: cashBalances,
    expenseTypes: expenseTypes,
  }, { merge: true });

  console.log(`   ✓ ${dedupedBalances.length} balance records migrated`);
  console.log(`   ✓ ${expenseTypes.length} expense types migrated\n`);

  // ── 5. Copy income_configs ─────────────────────────────────────────────────
  console.log('5️⃣   Copying income_configs...');
  const incomeSnap = await db.collection('income_configs').get();
  const incomeOps  = incomeSnap.docs.map(d => ({
    ref:  db.collection('families').doc(FAMILY_ID).collection('income-configs').doc(d.id),
    data: d.data(),
  }));
  await batchWrite(incomeOps);
  console.log(`   ✓ ${incomeOps.length} income configs copied\n`);

  // ── Done ───────────────────────────────────────────────────────────────────
  console.log('✅  Migration complete!\n');
  console.log('   Family ID :', FAMILY_ID);
  console.log('   Expenses  :', expOps.length);
  console.log('   Users     :', usersSnap.size);
  console.log('   Balances  :', dedupedBalances.length);
  console.log('   Income cfg:', incomeOps.length);
  console.log('\n⚠️   Old top-level collections (expenses, settings, income_configs)');
  console.log('   are NOT deleted — kept as backup. Delete manually after verification.\n');
}

main().catch(err => { console.error('❌ Migration failed:', err); process.exit(1); });
