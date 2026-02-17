// Script to activate all inactive records in Firebase
const admin = require('firebase-admin');
const serviceAccount = require('./.env.serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function activateAllInactiveRecords() {
  try {
    console.log('Fetching all expenses...');
    const snapshot = await db.collection('expenses').get();
    
    let inactiveCount = 0;
    let activatedCount = 0;
    const batch = db.batch();
    
    snapshot.docs.forEach(doc => {
      const data = doc.data();
      if (data.status === 'inactive') {
        inactiveCount++;
        console.log(`Found inactive record: ${doc.id} - ${data.Description || 'No description'} - Date: ${data.Date}`);
        batch.update(doc.ref, { status: 'active' });
        activatedCount++;
      }
    });
    
    if (activatedCount > 0) {
      console.log(`\nActivating ${activatedCount} inactive records...`);
      await batch.commit();
      console.log(`✅ Successfully activated ${activatedCount} records!`);
    } else {
      console.log('No inactive records found.');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

activateAllInactiveRecords();
