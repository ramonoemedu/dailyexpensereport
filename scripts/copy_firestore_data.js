// Script to copy Firestore data from production to development
// Usage: node scripts/copy_firestore_data.js

const { initializeApp, getApps, getApp } = require('firebase/app');
const { getFirestore, collection, getDocs, setDoc, doc } = require('firebase/firestore');
require('dotenv').config({ path: '.env.production' });

async function copyCollection(sourceDb, targetDb, collectionName) {
  const snapshot = await getDocs(collection(sourceDb, collectionName));
  for (const document of snapshot.docs) {
    await setDoc(doc(targetDb, collectionName, document.id), document.data());
    console.log(`Copied document ${document.id} in collection ${collectionName}`);
  }
}

async function main() {
  // Initialize production app (source)
  const prodConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  const prodApp = initializeApp(prodConfig, 'prod');
  const prodDb = getFirestore(prodApp);

  // Load dev config
  require('dotenv').config({ path: '.env.local', override: true });
  const devConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
  };
  const devApp = initializeApp(devConfig, 'dev');
  const devDb = getFirestore(devApp);

  // List collections to copy
  const collectionsToCopy = ['expenses', 'settings', 'income_configs','system_users']; // Add more as needed

  for (const col of collectionsToCopy) {
    await copyCollection(prodDb, devDb, col);
  }

  console.log('Copy complete!');
}

main().catch(console.error);
