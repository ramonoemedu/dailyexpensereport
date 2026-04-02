#!/bin/bash
# Shell script to run the Firestore copy script

echo "Installing dependencies (if needed)..."
npm install firebase dotenv

echo "Running Firestore data copy from production to development..."
node scripts/copy_firestore_data.js