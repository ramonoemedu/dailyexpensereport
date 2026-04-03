/**
 * Sync Production → UAT (full family data)
 *
 * What it does:
 *   1. Copies families doc
 *   2. Deletes + rewrites all expenses
 *   3. Copies settings/config (balances, expenseTypes)
 *   4. Syncs system_users (families map)
 *
 * Usage: node scripts/sync-prod-to-uat-expenses.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const FAMILY_ID = 'HfLedbulpkLaeFMXwkVK';
const BATCH_SIZE = 400;

// Init PROD
const saProd = require(path.resolve(__dirname, '../serviceAccountKeyProd.json'));
const prodApp = admin.initializeApp({ credential: admin.credential.cert(saProd) }, 'prod');
const prodDb = admin.firestore(prodApp);

// Init UAT
const saUat = require(path.resolve(__dirname, '../serviceAccountKey.json'));
const uatApp = admin.initializeApp({ credential: admin.credential.cert(saUat) }, 'uat');
const uatDb = admin.firestore(uatApp);

async function deleteAll(ref) {
  const snap = await ref.get();
  if (snap.empty) return 0;
  for (let i = 0; i < snap.docs.length; i += BATCH_SIZE) {
    const batch = uatDb.batch();
    snap.docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  return snap.size;
}

async function writeAll(colRef, docs) {
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = uatDb.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.set(colRef.doc(d.id), d.data()));
    await batch.commit();
    console.log(`  wrote ${Math.min(i + BATCH_SIZE, docs.length)}/${docs.length}`);
  }
}

(async () => {
  console.log('\n=== Sync PROD → UAT ===');
  console.log(`PROD: ${saProd.project_id}  UAT: ${saUat.project_id}\n`);

  // 1. Family doc
  console.log('1️⃣  Syncing family doc...');
  const famSnap = await prodDb.collection('families').doc(FAMILY_ID).get();
  await uatDb.collection('families').doc(FAMILY_ID).set(famSnap.data(), { merge: true });
  console.log('   ✓\n');

  // 2. Expenses
  console.log('2️⃣  Syncing expenses...');
  const prodExpenses = await prodDb.collection('families').doc(FAMILY_ID).collection('expenses').get();
  const uatExpensesRef = uatDb.collection('families').doc(FAMILY_ID).collection('expenses');
  const deleted = await deleteAll(uatExpensesRef);
  console.log(`   Deleted ${deleted} UAT expense docs`);
  await writeAll(uatExpensesRef, prodExpenses.docs);
  console.log(`   ✓ ${prodExpenses.size} expenses copied\n`);

  // 3. Settings/config
  console.log('3️⃣  Syncing settings/config...');
  const configSnap = await prodDb.collection('families').doc(FAMILY_ID).collection('settings').doc('config').get();
  if (configSnap.exists) {
    await uatDb.collection('families').doc(FAMILY_ID).collection('settings').doc('config').set(configSnap.data(), { merge: true });
    console.log('   ✓\n');
  } else {
    console.log('   No config found in prod\n');
  }

  // 4. system_users
  console.log('4️⃣  Syncing system_users...');
  const prodUsers = await prodDb.collection('system_users').get();
  for (const d of prodUsers.docs) {
    await uatDb.collection('system_users').doc(d.id).set(d.data(), { merge: true });
    console.log(`   ✓ ${d.data().username || d.id}`);
  }
  console.log();

  console.log('✅  Sync complete!');
  console.log(`   Expenses: ${prodExpenses.size}`);
  console.log(`   Users   : ${prodUsers.size}\n`);
  process.exit(0);
})().catch(err => { console.error('❌ Sync failed:', err); process.exit(1); });
