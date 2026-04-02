/**
 * Simulates what /api/users/me returns for ramonoem (system admin).
 * Runs the same logic as the API route using Admin SDK directly.
 */
const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const uid = 'uGGXOe4cs2OgsBX93ZkhpVXCwB72';

(async () => {
  const snap = await db.collection('system_users').doc(uid).get();
  const profile = snap.data();

  const mergedFamilies = { ...(profile?.families || {}) };

  const isSystemAdmin = profile?.systemAdmin === true;
  console.log('isSystemAdmin:', isSystemAdmin);

  if (isSystemAdmin) {
    const allFamiliesSnap = await db.collection('families').get();
    for (const famDoc of allFamiliesSnap.docs) {
      if (!mergedFamilies[famDoc.id]) {
        mergedFamilies[famDoc.id] = 'admin';
      }
    }
  }

  console.log('\nmergedFamilies returned to client:');
  console.log(JSON.stringify(mergedFamilies, null, 2));
  console.log('\nTotal families:', Object.keys(mergedFamilies).length);
  console.log('FamilySwitcher will show:', Object.keys(mergedFamilies).length > 1 ? '✅ YES' : '❌ NO (only 1 or 0 families)');
})().catch(console.error);
