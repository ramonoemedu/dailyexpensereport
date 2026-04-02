const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const uid = 'uGGXOe4cs2OgsBX93ZkhpVXCwB72';

(async () => {
  const snap = await db.collection('system_users').doc(uid).get();
  if (!snap.exists) {
    console.log('❌ No doc found at system_users/' + uid);
    process.exit(1);
  }
  const data = snap.data();
  console.log('✅ Doc found');
  console.log('  systemAdmin:', data.systemAdmin);
  console.log('  families:', JSON.stringify(data.families || {}, null, 2));
  console.log('\nFull doc:', JSON.stringify(data, null, 2));
})().catch(console.error);
