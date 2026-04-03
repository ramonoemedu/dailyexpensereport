/**
 * Populate the missing members subcollection in PROD.
 * Reads system_users docs that belong to a family and writes them into
 * families/{familyId}/members so the API works without the fallback.
 * Usage: node scripts/fix-prod-members.js
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
  console.log('🔍  Scanning system_users in PROD...\n');

  const usersSnap = await db.collection('system_users').get();

  // Group users by family
  const byFamily = {};
  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const families = d.families || {};
    for (const [famId, role] of Object.entries(families)) {
      if (!byFamily[famId]) byFamily[famId] = [];
      byFamily[famId].push({ uid: d.uid || doc.id, role, fullName: d.fullName || d.username || '', email: d.email || d.loginEmail || '' });
    }
  }

  for (const [famId, members] of Object.entries(byFamily)) {
    console.log(`👨‍👩‍👧  Family: ${famId}  (${members.length} member(s))`);

    for (const m of members) {
      const ref = db.collection('families').doc(famId).collection('members').doc(m.uid);
      const existing = await ref.get();

      if (existing.exists) {
        console.log(`   ⏭  ${m.uid} (${m.fullName}) already exists, skipping.`);
        continue;
      }

      const now = new Date().toISOString();
      await ref.set({
        uid: m.uid,
        role: m.role,
        fullName: m.fullName,
        email: m.email,
        addedAt: now,
        joinedAt: now,
      });
      console.log(`   ✅  Added ${m.uid} (${m.fullName}) as ${m.role}`);
    }
  }

  console.log('\n✅  Done.');
  process.exit(0);
}

main().catch(err => { console.error('❌', err); process.exit(1); });
