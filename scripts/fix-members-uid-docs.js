const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function fixMembersUidDocs() {
  console.log('Starting members UID doc repair...');

  const usersSnap = await db.collection('system_users').get();
  const usersByLegacyId = new Map();
  const usersByUid = new Map();

  usersSnap.forEach((userDoc) => {
    const data = userDoc.data() || {};
    usersByLegacyId.set(userDoc.id, data);
    if (data.uid) usersByUid.set(data.uid, data);
  });

  const familiesSnap = await db.collection('families').get();
  let fixed = 0;
  let scanned = 0;

  for (const familyDoc of familiesSnap.docs) {
    const familyId = familyDoc.id;
    const membersRef = db.collection('families').doc(familyId).collection('members');
    const membersSnap = await membersRef.get();

    let batch = db.batch();
    let ops = 0;

    for (const memberDoc of membersSnap.docs) {
      scanned++;
      const memberData = memberDoc.data() || {};

      const resolvedUid = memberData.uid
        || usersByLegacyId.get(memberDoc.id)?.uid
        || memberDoc.id;

      const role = memberData.role || 'member';
      const addedAt = memberData.addedAt || new Date().toISOString();
      const targetRef = membersRef.doc(resolvedUid);

      // Ensure canonical member doc exists at members/{authUid}
      batch.set(targetRef, { uid: resolvedUid, role, addedAt }, { merge: true });
      ops++;

      // Backfill uid on old doc and remove old non-canonical doc if it is different.
      if (!memberData.uid) {
        batch.set(memberDoc.ref, { uid: resolvedUid }, { merge: true });
        ops++;
      }
      if (memberDoc.id !== resolvedUid) {
        batch.delete(memberDoc.ref);
        ops++;
      }

      fixed++;

      if (ops >= 450) {
        await batch.commit();
        batch = db.batch();
        ops = 0;
      }
    }

    if (ops > 0) {
      await batch.commit();
    }

    console.log(`Family ${familyId}: repaired ${membersSnap.size} member docs`);
  }

  console.log(`Done. scanned=${scanned} fixed=${fixed}`);
}

fixMembersUidDocs()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Repair failed:', err);
    process.exit(1);
  });
