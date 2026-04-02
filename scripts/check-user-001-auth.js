const admin = require('firebase-admin');
const sa = require('../serviceAccountKey.json');
admin.initializeApp({ credential: admin.credential.cert(sa) });

(async () => {
  const auth = admin.auth();
  
  // Get user 001's Firebase auth info
  let firebaseUser = null;
  try {
    // Try to find by email
    firebaseUser = await auth.getUserByEmail('ramonoem@clearport.local');
    console.log('Found user by email:', firebaseUser.uid);
  } catch (e) {
    console.log('Not found by email, trying to list:', e.message);
  }
  
  if (!firebaseUser) {
    // List all users to find them
    const users = await auth.listUsers(100);
    for (const u of users.users) {
      if (u.email?.includes('ramonoem')) {
        firebaseUser = u;
        console.log('Found user:', u.uid, u.email);
        break;
      }
    }
  }
  
  if (!firebaseUser) {
    console.log('User not found in Firebase Auth');
    process.exit(0);
  }
  
  // Create an ID token
  const idToken = await auth.createCustomToken(firebaseUser.uid);
  console.log('\nID Token created for testing');
  
  // Now call /api/users/me with this token (simulated)
  const db = admin.firestore();
  const decoded = await auth.verifyIdToken(idToken);
  console.log('Decoded token uid:', decoded.uid);
  
  // Manually check what system_users has
  const userDoc = await db.collection('system_users').doc(decoded.uid).get();
  console.log('\n=== System User Document ===');
  console.log('Exists:', userDoc.exists);
  if (userDoc.exists) {
    const data = userDoc.data();
    console.log('UID:', data.uid);
    console.log('Username:', data.username);
    console.log('Families:', data.families);
  } else {
    // Search by uid
    const q = await db.collection('system_users').where('uid', '==', decoded.uid).limit(1).get();
    if (!q.empty) {
      const data = q.docs[0].data();
      console.log('Found by uid query:');
      console.log('UID:', data.uid);
      console.log('Username:', data.username);
      console.log('Families:', data.families);
    }
  }
  
  process.exit(0);
})().catch(e => {
  console.error('Error:', e.message);
  process.exit(1);
});
