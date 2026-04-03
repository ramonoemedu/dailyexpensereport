/**
 * Compare UAT vs PROD user management data to find why PROD shows no users.
 * Usage: node scripts/compare-uat-prd-users.js
 */
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const UAT_KEY = path.join(__dirname, '..', 'serviceAccountKey.json');
const PRD_KEY = path.join(__dirname, '..', 'serviceAccountKeyProd.json');

if (!fs.existsSync(UAT_KEY)) { console.error('❌ serviceAccountKey.json not found'); process.exit(1); }
if (!fs.existsSync(PRD_KEY)) { console.error('❌ serviceAccountKeyProd.json not found'); process.exit(1); }

const uatApp = admin.initializeApp({ credential: admin.credential.cert(require(UAT_KEY)) }, 'uat');
const prdApp = admin.initializeApp({ credential: admin.credential.cert(require(PRD_KEY)) }, 'prd');

const uatDb = uatApp.firestore();
const prdDb = prdApp.firestore();

async function checkEnv(db, label) {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  ${label}`);
  console.log(`${'='.repeat(60)}`);

  // Families
  const famSnap = await db.collection('families').get();
  console.log(`\n📁 Families (${famSnap.size}):`);
  for (const fam of famSnap.docs) {
    const famId = fam.id;
    console.log(`   ${famId}  name="${fam.data().name || ''}"`);

    // members subcollection
    const membersSnap = await db.collection('families').doc(famId).collection('members').get();
    console.log(`   └─ members subcollection: ${membersSnap.size} doc(s)`);
    for (const m of membersSnap.docs) {
      const d = m.data();
      console.log(`      - doc.id=${m.id}  uid=${d.uid || '(none)'}  role=${d.role || '(none)'}`);
    }
  }

  // system_users
  const usersSnap = await db.collection('system_users').get();
  console.log(`\n👤 system_users (${usersSnap.size}):`);
  for (const u of usersSnap.docs) {
    const d = u.data();
    console.log(`   doc.id=${u.id}`);
    console.log(`     uid=${d.uid || '(none)'}  username=${d.username || '(none)'}  status=${d.status || '(none)'}  systemAdmin=${d.systemAdmin || false}`);
    console.log(`     families=${JSON.stringify(d.families || {})}`);
    console.log(`     loginEmail=${d.loginEmail || '(none)'}`);
  }

  // Simulate the API: verifyAdmin → GET users
  console.log(`\n🔎 Simulating GET /api/admin/users:`);
  for (const fam of famSnap.docs) {
    const famId = fam.id;
    console.log(`\n  For family ${famId}:`);

    // Step 1: members subcollection
    const membersSnap = await db.collection('families').doc(famId).collection('members').get();
    const memberUids = [...new Set(membersSnap.docs.map(d => d.data().uid || d.id).filter(Boolean))];
    console.log(`  Step 1 — member UIDs from subcollection: [${memberUids.join(', ') || 'EMPTY'}]`);

    if (memberUids.length === 0) {
      // Step 2: fallback query
      console.log(`  Step 2 — Fallback: query system_users where families.${famId} in [admin,member,viewer]`);
      try {
        const q = await db.collection('system_users')
          .where(`families.${famId}`, 'in', ['admin', 'member', 'viewer'])
          .get();
        console.log(`  ✅ Fallback found ${q.size} user(s):`);
        for (const d of q.docs) {
          console.log(`     - ${d.data().username || d.id}`);
        }
      } catch (err) {
        console.log(`  ❌ Fallback query FAILED: ${err.message}`);
      }
    } else {
      // Step 2: look up each UID in system_users
      console.log(`  Step 2 — Looking up ${memberUids.length} UID(s) in system_users:`);
      for (const uid of memberUids) {
        const direct = await db.collection('system_users').doc(uid).get();
        if (direct.exists) {
          console.log(`     ✅ Found: ${uid} → username=${direct.data().username}`);
        } else {
          const byUid = await db.collection('system_users').where('uid', '==', uid).limit(1).get();
          if (!byUid.empty) {
            console.log(`     ✅ Found via uid field: ${uid} → username=${byUid.docs[0].data().username}`);
          } else {
            console.log(`     ❌ NOT FOUND in system_users: ${uid}`);
          }
        }
      }
    }
  }
}

async function main() {
  await checkEnv(uatDb, 'UAT (daily-expense-report-dev)');
  await checkEnv(prdDb, 'PROD (daily-expense-report-2de2d)');
  console.log('\n✅ Done.\n');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
