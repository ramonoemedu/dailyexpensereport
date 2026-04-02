const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  const uid = 'uGGXOe4cs2OgsBX93ZkhpVXCwB72';
  const userId = '001';
  const myFamilyId = 'HfLedbulpkLaeFMXwkVK';
  const vatFamilyId = 'noStutj06Gm5h4nuJ1oV';
  
  console.log('Adding user 001 (' + uid + ') as admin to both families...\n');
  
  // Update system_users to add VAT family
  await db.collection('system_users').doc(uid).set({
    families: {
      [myFamilyId]: 'admin',
      [vatFamilyId]: 'admin'
    }
  }, { merge: true });
  
  console.log('✓ Updated system_users families map');
  
  // Add member record in VAT family
  await db.collection('families').doc(vatFamilyId).collection('members').doc(uid).set({
    uid: uid,
    role: 'admin',
    addedAt: new Date().toISOString()
  }, { merge: true });
  
  console.log('✓ Added member record in VAT family');
  
  // Verify
  const userDoc = await db.collection('system_users').doc(uid).get();
  const userData = userDoc.data();
  
  console.log('\n=== Verification ===');
  console.log('User 001 (' + userData.username + '):');
  console.log('  Now admin in families: ' + JSON.stringify(userData.families));
  
  const myFamMember = await db.collection('families').doc(myFamilyId).collection('members').doc(uid).get();
  const vatFamMember = await db.collection('families').doc(vatFamilyId).collection('members').doc(uid).get();
  
  console.log('\nMember records:');
  console.log('  My Family: role=' + (myFamMember.exists ? myFamMember.data().role : 'N/A'));
  console.log('  VAT Family: role=' + (vatFamMember.exists ? vatFamMember.data().role : 'N/A'));
  
  console.log('\n✓ User 001 can now see 2 families as admin!');
  
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
