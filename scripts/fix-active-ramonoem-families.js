const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const uid = 'kBALqJK01FTOZela3E8nuyQ7Jm42';
  const familyA = 'HfLedbulpkLaeFMXwkVK';
  const familyB = 'noStutj06Gm5h4nuJ1oV';

  await db.collection('system_users').doc(uid).set({
    uid,
    families: {
      [familyA]: 'admin',
      [familyB]: 'admin',
    },
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  await db.collection('families').doc(familyB).collection('members').doc(uid).set({
    uid,
    role: 'admin',
    addedAt: new Date().toISOString(),
  }, { merge: true });

  const userDoc = await db.collection('system_users').doc(uid).get();
  const userData = userDoc.data() || {};
  const familyBMember = await db.collection('families').doc(familyB).collection('members').doc(uid).get();

  console.log(JSON.stringify({
    uid,
    families: userData.families || {},
    familyBMember: familyBMember.exists ? familyBMember.data() : null,
  }, null, 2));
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
