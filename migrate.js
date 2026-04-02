const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

// Initialize Firebase Admin
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function runMigration() {
  console.log('🚀 Starting non-destructive Firestore Multi-Role Migration...');

  try {
    // ----------------------------------------------------------------------
    // 1. SETUP BATCH MANAGER (Firestore limits batches to 500 operations)
    // ----------------------------------------------------------------------
    let batches = [];
    let currentBatch = db.batch();
    let operationCount = 0;

    const commitWithBatchManager = (operation, ref, data, options = {}) => {
      if (operationCount >= 490) {
        batches.push(currentBatch);
        currentBatch = db.batch();
        operationCount = 0;
      }
      if (operation === 'set') currentBatch.set(ref, data, options);
      if (operation === 'update') currentBatch.update(ref, data);
      operationCount++;
    };

    // ----------------------------------------------------------------------
    // 2. CREATE THE MIGRATED FAMILY
    // ----------------------------------------------------------------------
    const newFamilyRef = db.collection('families').doc(); // Auto-generates an ID
    const familyId = newFamilyRef.id;
    console.log(`\n🏠 Creating new Family document with ID: ${familyId}`);

    commitWithBatchManager('set', newFamilyRef, {
      name: 'My Family',
      createdAt: new Date().toISOString(),
      migrated: true
    });

    // ----------------------------------------------------------------------
    // 3. FETCH & MIGRATE SYSTEM_USERS
    // ----------------------------------------------------------------------
    console.log('\n👥 Migrating Users...');
    const usersSnapshot = await db.collection('system_users').get();
    let userCount = 0;

    usersSnapshot.forEach((doc) => {
      const userData = doc.data();
      const uid = userData.uid || doc.id;

      // A. Create the member doc in the family's subcollection
      const memberRef = db.collection('families').doc(familyId).collection('members').doc(uid);
      commitWithBatchManager('set', memberRef, {
        role: 'admin', // Everyone gets admin initially so they don't lose access
        uid,
        addedAt: new Date().toISOString()
      });

      // B. Update the user's profile with the new 'families' map
      const userRef = db.collection('system_users').doc(uid);
      commitWithBatchManager('update', userRef, {
        families: {
          [familyId]: 'admin'
        }
      });
      userCount++;
    });
    console.log(`✅ Queued ${userCount} users for migration.`);

    // ----------------------------------------------------------------------
    // 4. FETCH, CONSOLIDATE, & MIGRATE SETTINGS
    // ----------------------------------------------------------------------
    console.log('\n⚙️ Consolidating and Migrating Settings...');
    const settingsSnapshot = await db.collection('settings').get();
    const consolidatedSettings = {};

    settingsSnapshot.forEach((doc) => {
      // We take every doc (expenseTypes, balance_2026, etc.) and put it inside one big object
      consolidatedSettings[doc.id] = doc.data();
    });

    const configRef = db.collection('families').doc(familyId).collection('settings').doc('config');
    commitWithBatchManager('set', configRef, consolidatedSettings);
    console.log(`✅ Queued ${settingsSnapshot.size} settings docs into ONE consolidated config doc.`);

    // ----------------------------------------------------------------------
    // 5. FETCH & MIGRATE EXPENSES
    // ----------------------------------------------------------------------
    console.log('\n💰 Migrating Expenses...');
    const expensesSnapshot = await db.collection('expenses').get();
    let expenseCount = 0;

    expensesSnapshot.forEach((doc) => {
      const expenseData = doc.data();
      const expenseId = doc.id;

      // Copy expense to the new family subcollection
      const newExpenseRef = db.collection('families').doc(familyId).collection('expenses').doc(expenseId);
      commitWithBatchManager('set', newExpenseRef, expenseData);
      expenseCount++;
    });
    console.log(`✅ Queued ${expenseCount} expenses for migration.`);

    // ----------------------------------------------------------------------
    // 6. COMMIT ALL BATCHES TO FIRESTORE
    // ----------------------------------------------------------------------
    console.log('\n⏳ Committing all changes to Firestore...');
    batches.push(currentBatch); // Push the final batch

    for (let i = 0; i < batches.length; i++) {
      await batches[i].commit();
      console.log(`   -> Committed batch ${i + 1} of ${batches.length}`);
    }

    console.log('\n🎉 MIGRATION COMPLETE! Your data has been safely copied to the new structure.');
    console.log('⚠️ Note: Your old "expenses" and "settings" collections are still there. Do not delete them until you are 100% sure the new app logic is working!');

  } catch (error) {
    console.error('\n❌ Error during migration:', error);
  }
}

// Execute the script
runMigration();