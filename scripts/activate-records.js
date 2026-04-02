// Script to activate all inactive records in Firebase
const admin = require('firebase-admin');
const serviceAccount = require('./.env.serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function activateAllInactiveRecords() {
  try {
    console.log('Fetching all family expense records...');
    const familiesSnapshot = await db.collection('families').get();

    let inactiveCount = 0;
    let activatedCount = 0;
    let batch = db.batch();
    let batchOps = 0;

    for (const familyDoc of familiesSnapshot.docs) {
      const familyId = familyDoc.id;
      const expensesSnapshot = await db
        .collection('families')
        .doc(familyId)
        .collection('expenses')
        .where('status', '==', 'inactive')
        .get();

      for (const expenseDoc of expensesSnapshot.docs) {
        const data = expenseDoc.data();
        inactiveCount++;
        console.log(`Found inactive record: family=${familyId} id=${expenseDoc.id} - ${data.Description || 'No description'} - Date: ${data.Date}`);
        batch.update(expenseDoc.ref, { status: 'active' });
        activatedCount++;
        batchOps++;

        if (batchOps === 500) {
          // Firestore batches have a hard limit of 500 operations.
          await batch.commit();
          batch = db.batch();
          batchOps = 0;
        }
      }
    }

    if (batchOps > 0) {
      await batch.commit();
    }

    if (activatedCount > 0) {
      console.log(`\nSuccessfully activated ${activatedCount} records.`);
    } else {
      console.log('No inactive records found in family expenses.');
    }

    console.log(`Total inactive found: ${inactiveCount}`);
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateAllInactiveRecords();
