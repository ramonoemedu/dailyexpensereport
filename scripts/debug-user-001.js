const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  // Find user with username or uid '001'
  const byUsername = await db.collection('system_users').where('username', '==', '001').get();
  const byUid = await db.collection('system_users').where('uid', '==', '001').get();
  
  console.log('=== User Search ===');
  console.log('By username: ' + byUsername.size + ' docs');
  console.log('By uid: ' + byUid.size + ' docs');
  
  let targetDocs = byUsername.size > 0 ? byUsername.docs : byUid.docs;
  
  if (targetDocs.length === 0) {
    console.log('User 001 not found');
    process.exit(0);
  }
  
  for (const doc of targetDocs) {
    const data = doc.data();
    const uid = data.uid;
    const families = data.families || {};
    
    console.log('\n=== System User Document ===');
    console.log('Doc ID: ' + doc.id);
    console.log('UID: ' + uid);
    console.log('Username: ' + data.username);
    console.log('Email: ' + data.email);
    console.log('Families in system_users: ' + JSON.stringify(families));
    
    // Check each family
    console.log('\n=== Family Access Check ===');
    const familyIds = Object.keys(families);
    console.log('Admin in ' + familyIds.length + ' families');
    
    for (const fid of familyIds) {
      const member = await db.collection('families').doc(fid).collection('members').doc(uid).get();
      const memberExists = member.exists;
      const memberData = member.data() || {};
      
      console.log('\nFamily ' + fid + ':');
      console.log('  Role in system_users: ' + families[fid]);
      console.log('  Member doc exists: ' + memberExists);
      console.log('  Member role: ' + memberData.role);
    }
    
    // Also check all families to see if user exists as member
    console.log('\n=== Cross-Check: All Families ===');
    const allFams = await db.collection('families').get();
    console.log('Total families: ' + allFams.size);
    
    let foundInMembers = 0;
    let mismatch = 0;
    
    for (const fam of allFams.docs) {
      const member = await db.collection('families').doc(fam.id).collection('members').doc(uid).get();
      if (member.exists) {
        foundInMembers++;
        const role = member.data().role;
        const inSystemUsers = families[fam.id] !== undefined;
        const status = inSystemUsers ? 'OK' : 'MISMATCH';
        
        if (!inSystemUsers) mismatch++;
        
        console.log('  Family ' + fam.id + ': role=' + role + ', in_system_users=' + inSystemUsers + ' [' + status + ']');
      }
    }
    
    console.log('\n=== Summary ===');
    console.log('Admin in system_users: ' + familyIds.length);
    console.log('Member docs found: ' + foundInMembers);
    console.log('Mismatches (in members but not system_users): ' + mismatch);
  }
  
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
