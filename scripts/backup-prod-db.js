/**
 * Backup Production Firestore → local JSON files
 * Usage: node scripts/backup-prod-db.js
 *
 * Output: backups/prod-backup-YYYY-MM-DD_HH-MM-SS/
 *   ├── expenses.json          (legacy top-level)
 *   ├── system_users.json
 *   ├── families.json          (family docs)
 *   ├── families_expenses.json (family-scoped expenses)
 *   ├── families_settings.json (family-scoped settings)
 *   ├── families_members.json  (family-scoped members)
 *   └── manifest.json          (counts + timestamp)
 */

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// ── Credentials ──────────────────────────────────────────────────────────────
const PROD_KEY_PATH = path.join(__dirname, '..', 'serviceAccountKeyProd.json');
if (!fs.existsSync(PROD_KEY_PATH)) {
  console.error('❌  serviceAccountKeyProd.json not found at project root.');
  process.exit(1);
}

const serviceAccount = require(PROD_KEY_PATH);
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

// ── Output dir ────────────────────────────────────────────────────────────────
const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const outDir = path.join(__dirname, '..', 'backups', `prod-backup-${ts}`);
fs.mkdirSync(outDir, { recursive: true });

function save(filename, data) {
  fs.writeFileSync(path.join(outDir, filename), JSON.stringify(data, null, 2));
}

async function backupCollection(colRef, label) {
  const snap = await colRef.get();
  const docs = snap.docs.map(d => ({ id: d.id, data: d.data() }));
  console.log(`  ✓ ${label}: ${docs.length} docs`);
  return docs;
}

async function main() {
  console.log(`\n📦  Starting production backup → ${outDir}\n`);
  const manifest = { timestamp: new Date().toISOString(), collections: {} };

  // ── Top-level collections ────────────────────────────────────────────────
  const expenses = await backupCollection(db.collection('expenses'), 'expenses (legacy)');
  save('expenses.json', expenses);
  manifest.collections.expenses = expenses.length;

  const systemUsers = await backupCollection(db.collection('system_users'), 'system_users');
  save('system_users.json', systemUsers);
  manifest.collections.system_users = systemUsers.length;

  // ── Families + sub-collections ──────────────────────────────────────────
  const familiesSnap = await db.collection('families').get();
  const familyDocs = familiesSnap.docs.map(d => ({ id: d.id, data: d.data() }));
  console.log(`  ✓ families: ${familyDocs.length} docs`);
  save('families.json', familyDocs);
  manifest.collections.families = familyDocs.length;

  const familyExpenses = [];
  const familySettings = [];
  const familyMembers = [];

  for (const family of familyDocs) {
    const fid = family.id;

    const expSnap = await db.collection('families').doc(fid).collection('expenses').get();
    expSnap.docs.forEach(d => familyExpenses.push({ familyId: fid, id: d.id, data: d.data() }));

    const setSnap = await db.collection('families').doc(fid).collection('settings').get();
    setSnap.docs.forEach(d => familySettings.push({ familyId: fid, id: d.id, data: d.data() }));

    const memSnap = await db.collection('families').doc(fid).collection('members').get();
    memSnap.docs.forEach(d => familyMembers.push({ familyId: fid, id: d.id, data: d.data() }));
  }

  console.log(`  ✓ families/*/expenses: ${familyExpenses.length} docs`);
  console.log(`  ✓ families/*/settings: ${familySettings.length} docs`);
  console.log(`  ✓ families/*/members:  ${familyMembers.length} docs`);

  save('families_expenses.json', familyExpenses);
  save('families_settings.json', familySettings);
  save('families_members.json', familyMembers);

  manifest.collections.families_expenses = familyExpenses.length;
  manifest.collections.families_settings = familySettings.length;
  manifest.collections.families_members  = familyMembers.length;

  save('manifest.json', manifest);

  const total = Object.values(manifest.collections).reduce((a, b) => a + b, 0);
  console.log(`\n✅  Backup complete — ${total} total docs saved to:\n   ${outDir}\n`);
}

main().catch(err => { console.error('❌ Backup failed:', err); process.exit(1); });
