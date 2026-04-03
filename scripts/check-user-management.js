/**
 * Diagnose why User Management shows no users in prod.
 * Usage: node scripts/check-user-management.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const KEY_PATH = path.join(__dirname, '..', 'serviceAccountKeyProd.json');
if (!fs.existsSync(KEY_PATH)) {
  console.error('❌  serviceAccountKeyProd.json not found.');
  process.exit(1);
}

admin.initializeApp({ credential: admin.credential.cert(require(KEY_PATH)) });
const db = admin.firestore();

async function main() {
  console.log('🔍  Checking prod User Management data...\n');

  // 1. List all families
  const familiesSnap = await db.collection('families').get();
  console.log(`📁  Families (${familiesSnap.size}):`);
  for (const fam of familiesSnap.docs) {
    console.log(`   - ${fam.id}  name="${fam.data().name || ''}"`);
  }
  console.log();

  // 2. For each family, check members subcollection
  for (const fam of familiesSnap.docs) {
    const famId = fam.id;
    const membersSnap = await db.collection('families').doc(famId).collection('members').get();
    console.log(`👨‍👩‍👧  Family ${famId} — members subcollection: ${membersSnap.size} doc(s)`);
    for (const m of membersSnap.docs) {
      console.log(`     doc.id=${m.id}  uid=${m.data().uid || '(none)'}  role=${m.data().role || '(none)'}`);
    }
    console.log();
  }

  // 3. List all system_users and their families field
  const usersSnap = await db.collection('system_users').get();
  console.log(`👤  system_users (${usersSnap.size} total):`);
  for (const u of usersSnap.docs) {
    const d = u.data();
    console.log(`   doc.id=${u.id}`);
    console.log(`     uid=${d.uid || '(none)'}  username=${d.username || '(none)'}  status=${d.status || '(none)'}`);
    console.log(`     families=${JSON.stringify(d.families || {})}`);
  }
  console.log();

  // 4. Test the fallback query: system_users where families.{familyId} in [admin, member, viewer]
  for (const fam of familiesSnap.docs) {
    const famId = fam.id;
    console.log(`🔎  Fallback query for family ${famId}:`);
    try {
      const q = await db.collection('system_users')
        .where(`families.${famId}`, 'in', ['admin', 'member', 'viewer'])
        .get();
      console.log(`   → Found ${q.size} user(s) via families.${famId} query`);
      for (const d of q.docs) {
        console.log(`     - ${d.id}  username=${d.data().username || '(none)'}`);
      }
    } catch (err) {
      console.log(`   ❌ Query failed: ${err.message}`);
    }
    console.log();
  }

  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
