const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function normalizeFamilyConfig(familyId) {
  const ref = db.collection('families').doc(familyId).collection('settings').doc('config');
  const snap = await ref.get();
  const cfg = snap.exists ? (snap.data() || {}) : {};

  let incomeConfigs = Array.isArray(cfg.incomeConfigs) ? cfg.incomeConfigs : [];
  let incomeTypes = Array.isArray(cfg.incomeTypes) ? cfg.incomeTypes : [];

  // Keep legacy objects if present, but coerce into standard shape.
  incomeConfigs = incomeConfigs
    .map((item, idx) => {
      const name = String(item?.name || '').trim();
      if (!name) return null;
      return {
        id: String(item?.id || `seed_${idx + 1}`),
        name,
        amount: Number(item?.amount || 0),
        dayOfMonth: Number(item?.dayOfMonth || 1),
        status: item?.status === 'inactive' ? 'inactive' : 'active',
      };
    })
    .filter(Boolean);

  if (incomeConfigs.length === 0 && incomeTypes.length > 0) {
    incomeConfigs = incomeTypes
      .map((name, idx) => ({
        id: `seed_${idx + 1}`,
        name: String(name).trim(),
        amount: 0,
        dayOfMonth: 1,
        status: 'inactive',
      }))
      .filter((x) => x.name.length > 0);
  }

  incomeTypes = incomeConfigs.map((x) => x.name);

  // Normalize legacy expenseTypes map { types: [] } to array []
  const expenseTypes = Array.isArray(cfg.expenseTypes)
    ? cfg.expenseTypes
    : cfg.expenseTypes && Array.isArray(cfg.expenseTypes.types)
      ? cfg.expenseTypes.types
      : [];

  await ref.set(
    {
      ...cfg,
      incomeConfigs,
      incomeTypes,
      expenseTypes,
      updatedAt: new Date().toISOString(),
    },
    { merge: true }
  );

  const after = (await ref.get()).data() || {};
  console.log('familyId=' + familyId);
  console.log('incomeConfigs_count=' + (Array.isArray(after.incomeConfigs) ? after.incomeConfigs.length : 0));
  console.log('incomeTypes_count=' + (Array.isArray(after.incomeTypes) ? after.incomeTypes.length : 0));
  console.log('expenseTypes_isArray=' + String(Array.isArray(after.expenseTypes)));
}

normalizeFamilyConfig('HfLedbulpkLaeFMXwkVK')
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
