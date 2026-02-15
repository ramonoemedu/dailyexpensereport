const { initializeApp } = require('firebase/app');
const { getFirestore, collection, addDoc } = require('firebase/firestore');

const firebaseConfig = {
  apiKey: "AIzaSyAc6VfX2_Mx2j4X9hdp5ZtAkH2-VkyBdLM",
  authDomain: "daily-expense-report-2de2d.firebaseapp.com",
  projectId: "daily-expense-report-2de2d",
  storageBucket: "daily-expense-report-2de2d.firebasestorage.app",
  messagingSenderId: "129632465691",
  appId: "1:129632465691:web:25c7b709c29118f5c019be"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function addUser() {
  const newUser = {
    username: 'admin',
    userId: '007',
    loginEmail: 'ramonoemedu@gmail.com', // Mapping to your existing email
    status: 'active'
  };

  console.log(`Adding user: ${newUser.username} (ID: ${newUser.userId})...`);
  
  try {
    const docRef = await addDoc(collection(db, 'system_users'), newUser);
    console.log('User added successfully! Document ID:', docRef.id);
    console.log(`You can now log in using "${newUser.username}" or "${newUser.userId}"`);
  } catch (error) {
    console.error('Error adding user:', error);
  }
  
  process.exit(0);
}

addUser();
