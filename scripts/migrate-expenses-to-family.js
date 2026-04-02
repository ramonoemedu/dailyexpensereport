/**
 * Migration script: copy top-level `expenses` collection
 * into `families/{familyId}/expenses`.
 *
 * Usage:
 *   node scripts/migrate-expenses-to-family.js <familyId>
 *
 * Example:
 *   node scripts/migrate-expenses-to-family.js HfLedbulpkLaeFMXwkVK
 */

const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const familyId = process.argv[2];
if (!familyId) {
  console.error('ERROR: Please provide a familyId as the first argument.');
  console.error('  node scripts/migrate-expenses-to-family.js <familyId>');
  process.exit(1);
}

(async () => {
  console.log(`\nMigrating expenses -> families/${familyId}/expenses ...\n`);

  const sourceSnap = await db.collection('expenses').get();

  if (sourceSnap.empty) {
    console.log('No documents found in top-level `expenses` collection. Nothing to migrate.');
    process.exit(0);
  }

  console.log(`Found ${sourceSnap.size} documents in top-level expenses.`);

  // Check how many already exist in the target to avoid duplicates
  const targetSnap = await db.collection('families').doc(familyId).collection('expenses').get();
  const existingIds = new Set(targetSnap.docs.map(d => d.id));
  console.log(`Target already has ${existingIds.size} documents.`);

  const BATCH_SIZE = 400;
  let batch = db.batch();
  let count = 0;
  let skipped = 0;
  let written = 0;

  for (const docSnap of sourceSnap.docs) {
    if (existingIds.has(docSnap.id)) {
      skipped++;
      continue;
    }

    const ref = db.collection('families').doc(familyId).collection('expenses').doc(docSnap.id);
    batch.set(ref, docSnap.data(), { merge: false });
    count++;
    written++;

    if (count === BATCH_SIZE) {
      await batch.commit();
      console.log(`  Committed batch of ${count}...`);
      batch = db.batch();
      count = 0;
    }
  }

  if (count > 0) {
    await batch.commit();
    console.log(`  Committed final batch of ${count}.`);
  }

  console.log(`\nDone!`);
  console.log(`  Written : ${written}`);
  console.log(`  Skipped (already exist): ${skipped}`);
  console.log(`  Total source docs: ${sourceSnap.size}`);
})().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
