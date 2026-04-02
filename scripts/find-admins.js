const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

(async () => {
  console.log('=== All Users and Their Families ===\n');
  
  const users = await db.collection('system_users').get();
  console.log('Total users: ' + users.size);
  
  const userList = [];
  
  for (const doc of users.docs) {
    const data = doc.data();
    const uid = data.uid;
    const username = data.username;
    const families = data.families || {};
    const familyCount = Object.keys(families).length;
    
    const adminFamilies = [];
    for (const [fid, role] of Object.entries(families)) {
      if (role === 'admin') {
        adminFamilies.push(fid);
      }
    }
    
    userList.push({
      docId: doc.id,
      uid,
      username,
      totalFamilies: familyCount,
      adminCount: adminFamilies.length,
      families: families,
      adminFamilies: adminFamilies
    });
  }
  
  // Sort by admin count
  userList.sort((a, b) => b.adminCount - a.adminCount);
  
  for (const user of userList) {
    console.log('Username: ' + user.username + ' | UID: ' + user.uid);
    console.log('  Total families: ' + user.totalFamilies + ' | Admin in: ' + user.adminCount);
    console.log('  Roles: ' + JSON.stringify(user.families));
    
    if (user.username === '001' || user.uid === '001') {
      console.log('  ^^^ THIS IS USER 001 ^^^');
    }
    console.log('');
  }
  
  // Find any orphaned member records
  console.log('\n=== Orphaned Member Checks ===');
  
  const families = await db.collection('families').get();
  
  for (const fam of families.docs) {
    const members = await db.collection('families').doc(fam.id).collection('members').get();
    
    for (const mem of members.docs) {
      const memData = mem.data();
      const uid = memData.uid;
      const memId = mem.id;
      
      // Check if this uid exists in system_users
      const sysUserQuery = await db.collection('system_users').where('uid', '==', uid).get();
      if (sysUserQuery.size === 0) {
        console.log('ORPHAN: Family ' + fam.id + ' has member ' + memId + ' (uid=' + uid + ') but no system_user');
      }
      
      // Check if this family is in user's family list
      if (sysUserQuery.size > 0) {
        const sysUserDoc = sysUserQuery.docs[0];
        const families = sysUserDoc.data().families || {};
        if (!families[fam.id]) {
          console.log('MISMATCH: Family ' + fam.id + ' has member ' + sysUserDoc.data().username + ' but not in system_users.families');
        }
      }
    }
  }
  
  process.exit(0);
})().catch(e => {
  console.error(e);
  process.exit(1);
});
