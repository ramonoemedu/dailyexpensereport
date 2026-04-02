/**
 * Sync Production expenses → UAT "My Family"
 *
 * What it does:
 *   1. Reads ALL expenses from PROD  families/HfLedbulpkLaeFMXwkVK/expenses
 *   2. Deletes ALL expenses in UAT   families/HfLedbulpkLaeFMXwkVK/expenses
 *   3. Writes the prod docs into UAT (same document IDs preserved)
 *
 * Usage:
 *   node scripts/sync-prod-to-uat-expenses.js
 *
 * Requirements:
 *   - .env.production must have FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY
 *   - serviceAccountKey.json (UAT dev project) must exist in project root
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const FAMILY_ID = 'HfLedbulpkLaeFMXwkVK';
const BATCH_SIZE = 400;

// --- Init PROD app (serviceAccountKeyProd.json) ---
const saProdPath = path.resolve(__dirname, '../serviceAccountKeyProd.json');
if (!fs.existsSync(saProdPath)) {
  console.error('ERROR: serviceAccountKeyProd.json not found at project root');
  process.exit(1);
}
const saProd = require(saProdPath);
const prodApp = admin.initializeApp({ credential: admin.credential.cert(saProd) }, 'prod');
const prodDb = admin.firestore(prodApp);

// --- Init UAT app (serviceAccountKey.json) ---
const saPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(saPath)) {
  console.error('ERROR: serviceAccountKey.json not found at project root');
  process.exit(1);
}
const sa = require(saPath);
const uatApp = admin.initializeApp({ credential: admin.credential.cert(sa) }, 'uat');
const uatDb = admin.firestore(uatApp);

async function deleteInBatches(db, collectionRef, label) {
  const snap = await collectionRef.get();
  if (snap.empty) {
    console.log(`  ${label}: nothing to delete.`);
    return 0;
  }
  const docs = snap.docs;
  let deleted = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => batch.delete(d.ref));
    await batch.commit();
    deleted += Math.min(BATCH_SIZE, docs.length - i);
    console.log(`  Deleted ${deleted}/${docs.length} UAT expense docs...`);
  }
  return deleted;
}

async function writeInBatches(db, collectionRef, docs, label) {
  let written = 0;
  for (let i = 0; i < docs.length; i += BATCH_SIZE) {
    const batch = db.batch();
    docs.slice(i, i + BATCH_SIZE).forEach(d => {
      batch.set(collectionRef.doc(d.id), d.data());
    });
    await batch.commit();
    written += Math.min(BATCH_SIZE, docs.length - i);
    console.log(`  Wrote ${written}/${docs.length} docs to UAT...`);
  }
  return written;
}

(async () => {
  console.log('\n=== Sync PROD → UAT expenses ===');
  console.log(`Family ID: ${FAMILY_ID}`);
  console.log(`PROD project: ${saProd.project_id}`);
  console.log(`UAT project: ${sa.project_id}\n`);

  // Step 1: Read prod expenses (top-level collection — prod not yet migrated to family structure)
  console.log('Step 1: Reading expenses from PROD (top-level expenses collection)...');
  const prodSnap = await prodDb.collection('expenses').get();
  console.log(`  Found ${prodSnap.size} expense docs in PROD.\n`);

  if (prodSnap.empty) {
    console.log('No prod expenses found. Aborting.');
    process.exit(0);
  }

  // Step 2: Delete UAT expenses
  console.log('Step 2: Deleting existing UAT expenses...');
  const uatExpensesRef = uatDb.collection('families').doc(FAMILY_ID).collection('expenses');
  const deletedCount = await deleteInBatches(uatDb, uatExpensesRef, 'UAT expenses');
  console.log(`  Done. Deleted ${deletedCount} UAT docs.\n`);

  // Step 3: Write prod expenses to UAT
  console.log('Step 3: Copying PROD expenses into UAT...');
  const writtenCount = await writeInBatches(uatDb, uatExpensesRef, prodSnap.docs, 'UAT expenses');
  console.log(`  Done. Wrote ${writtenCount} docs.\n`);

  console.log(`=== Complete! Deleted ${deletedCount} UAT docs, Copied ${writtenCount} PROD docs ===\n`);
  process.exit(0);
})().catch(err => {
  console.error('FATAL ERROR:', err);
  process.exit(1);
});
