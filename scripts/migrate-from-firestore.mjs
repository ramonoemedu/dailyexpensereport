/**
 * Firestore → PostgreSQL migration script
 *
 * Run ONCE on your machine (with both Firebase and PostgreSQL accessible):
 *   node scripts/migrate-from-firestore.mjs
 *
 * Requirements:
 *   1. serviceAccountKey.json in project root (Firebase admin key)
 *   2. DATABASE_URL env var pointing to the new PostgreSQL database
 *   3. Prisma schema already migrated: npm run db:push
 *
 * What it does:
 *   - Exports system_users, families, members, expenses, settings, reports, pdf_conversions
 *   - Imports into PostgreSQL via Prisma
 *   - Sets a temporary password "ChangeMe2026!" for all migrated users
 *     (users must reset after first login)
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';
import { readFileSync, existsSync } from 'fs';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load .env.production for DATABASE_URL if not already set
if (!process.env.DATABASE_URL) {
  const envPath = path.join(__dirname, '..', '.env.production');
  if (existsSync(envPath)) {
    const lines = readFileSync(envPath, 'utf8').split('\n');
    for (const line of lines) {
      const [key, ...rest] = line.split('=');
      if (key && rest.length) process.env[key.trim()] = rest.join('=').trim();
    }
  }
}

const { PrismaClient } = require('@prisma/client');
const { hash } = require('bcryptjs');
const { initializeApp, cert, getApps } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!existsSync(serviceAccountPath)) {
  console.error('ERROR: serviceAccountKey.json not found in project root.');
  process.exit(1);
}

const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

if (getApps().length === 0) {
  initializeApp({ credential: cert(serviceAccount) });
}

const db = getFirestore();
const prisma = new PrismaClient();

const TEMP_PASSWORD = 'ChangeMe2026!';

async function run() {
  console.log('Starting Firestore → PostgreSQL migration...\n');

  const tempPasswordHash = await hash(TEMP_PASSWORD, 12);
  let stats = {
    users: 0, families: 0, members: 0, expenses: 0,
    settings: 0, reports: 0, conversions: 0, skipped: 0,
  };

  // ── 1. USERS ────────────────────────────────────────────────────────────────
  console.log('Migrating system_users...');
  const usersSnap = await db.collection('system_users').get();

  for (const doc of usersSnap.docs) {
    const d = doc.data();
    const uid = d.uid || doc.id;
    const username = (d.username || `user_${uid.slice(0, 8)}`).toLowerCase().replace(/[^a-z0-9._-]/g, '');
    const userId = d.userId || `USR-${uid.slice(0, 6).toUpperCase()}`;

    try {
      await prisma.user.upsert({
        where: { uid },
        create: {
          uid,
          fullName: d.fullName || '',
          username,
          userId,
          email: d.email || '',
          loginEmail: d.loginEmail || d.email || '',
          passwordHash: tempPasswordHash,
          status: d.status || 'active',
          systemAdmin: d.systemAdmin || d.isSystemAdmin || false,
          families: d.families || {},
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: new Date(),
        },
        update: {
          fullName: d.fullName || '',
          families: d.families || {},
          status: d.status || 'active',
          systemAdmin: d.systemAdmin || d.isSystemAdmin || false,
          updatedAt: new Date(),
        },
      });
      stats.users++;
    } catch (err) {
      console.warn(`  SKIP user ${uid}: ${err.message}`);
      stats.skipped++;
    }
  }
  console.log(`  ✓ ${stats.users} users migrated\n`);

  // ── 2. FAMILIES ─────────────────────────────────────────────────────────────
  console.log('Migrating families...');
  const familiesSnap = await db.collection('families').get();

  for (const famDoc of familiesSnap.docs) {
    const d = famDoc.data();
    const familyId = famDoc.id;

    try {
      await prisma.family.upsert({
        where: { id: familyId },
        create: {
          id: familyId,
          name: d.name || familyId,
          status: d.status || 'active',
          createdBy: d.createdBy || null,
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: new Date(),
        },
        update: {
          name: d.name || familyId,
          status: d.status || 'active',
          updatedAt: new Date(),
        },
      });
      stats.families++;
    } catch (err) {
      console.warn(`  SKIP family ${familyId}: ${err.message}`);
      stats.skipped++;
    }

    // ── 3. MEMBERS ────────────────────────────────────────────────────────────
    const membersSnap = await famDoc.ref.collection('members').get();
    for (const memDoc of membersSnap.docs) {
      const m = memDoc.data();
      const uid = m.uid || memDoc.id;

      try {
        await prisma.familyMember.upsert({
          where: { familyId_uid: { familyId, uid } },
          create: {
            familyId,
            uid,
            role: m.role || 'member',
            fullName: m.fullName || '',
            email: m.email || '',
            addedAt: m.addedAt ? new Date(m.addedAt) : new Date(),
          },
          update: { role: m.role || 'member', fullName: m.fullName || '', email: m.email || '' },
        });
        stats.members++;
      } catch (err) {
        console.warn(`  SKIP member ${uid} in ${familyId}: ${err.message}`);
        stats.skipped++;
      }
    }

    // ── 4. EXPENSES ───────────────────────────────────────────────────────────
    console.log(`  Migrating expenses for family ${familyId}...`);
    const expSnap = await famDoc.ref.collection('expenses').get();

    const expenseData = expSnap.docs.map((expDoc) => {
      const e = expDoc.data();
      return {
        id: expDoc.id,
        familyId,
        date: String(e.Date || e.date || ''),
        amount: Math.abs(Number(e.Amount || e.amount || 0)),
        currency: String(e.Currency || e.currency || 'USD'),
        type: String(e.Type || e.type || 'Expense'),
        description: String(e.Description || e.description || ''),
        category: String(e.Category || e.category || ''),
        paymentMethod: String(e['Payment Method'] || e['Payment_Method'] || e.paymentMethod || ''),
        status: String(e.status || 'active'),
        importRef: String(e.importRef || ''),
        extraData: {},
        createdAt: e.createdAt ? new Date(e.createdAt) : new Date(),
        updatedAt: new Date(),
      };
    });

    // Insert in chunks of 500
    for (let i = 0; i < expenseData.length; i += 500) {
      const chunk = expenseData.slice(i, i + 500);
      try {
        await prisma.expense.createMany({ data: chunk, skipDuplicates: true });
        stats.expenses += chunk.length;
      } catch (err) {
        console.warn(`  SKIP expense chunk in ${familyId}: ${err.message}`);
        stats.skipped += chunk.length;
      }
    }

    // ── 5. SETTINGS ───────────────────────────────────────────────────────────
    const configSnap = await famDoc.ref.collection('settings').doc('config').get();
    if (configSnap.exists) {
      try {
        await prisma.familySettings.upsert({
          where: { familyId },
          create: { familyId, config: configSnap.data() || {}, updatedAt: new Date() },
          update: { config: configSnap.data() || {}, updatedAt: new Date() },
        });
        stats.settings++;
      } catch (err) {
        console.warn(`  SKIP settings ${familyId}: ${err.message}`);
        stats.skipped++;
      }
    }

    // ── 6. REPORTS ────────────────────────────────────────────────────────────
    const reportsSnap = await famDoc.ref.collection('reports').get();
    for (const repDoc of reportsSnap.docs) {
      const reportKey = repDoc.id; // e.g. "dashboard_2026" or "bank_chip-mong_2026"
      try {
        await prisma.familyReport.upsert({
          where: { familyId_reportKey: { familyId, reportKey } },
          create: { familyId, reportKey, data: repDoc.data() || {}, updatedAt: new Date() },
          update: { data: repDoc.data() || {}, updatedAt: new Date() },
        });
        stats.reports++;
      } catch (err) {
        console.warn(`  SKIP report ${reportKey} in ${familyId}: ${err.message}`);
        stats.skipped++;
      }
    }
  }

  console.log(`  ✓ ${stats.families} families, ${stats.members} members, ${stats.expenses} expenses, ${stats.settings} settings, ${stats.reports} reports\n`);

  // ── 7. PDF CONVERSIONS ──────────────────────────────────────────────────────
  console.log('Migrating pdf_conversions...');
  const convSnap = await db.collection('pdf_conversions').get();
  for (const convDoc of convSnap.docs) {
    const d = convDoc.data();
    try {
      await prisma.pdfConversion.upsert({
        where: { id: convDoc.id },
        create: {
          id: convDoc.id,
          userId: d.userId || '',
          data: d,
          createdAt: d.createdAt ? new Date(d.createdAt) : new Date(),
          updatedAt: new Date(),
        },
        update: { data: d, updatedAt: new Date() },
      });
      stats.conversions++;
    } catch (err) {
      console.warn(`  SKIP conversion ${convDoc.id}: ${err.message}`);
      stats.skipped++;
    }
  }
  console.log(`  ✓ ${stats.conversions} conversions\n`);

  console.log('═══════════════════════════════════════');
  console.log('Migration complete!');
  console.log(`  Users:       ${stats.users}`);
  console.log(`  Families:    ${stats.families}`);
  console.log(`  Members:     ${stats.members}`);
  console.log(`  Expenses:    ${stats.expenses}`);
  console.log(`  Settings:    ${stats.settings}`);
  console.log(`  Reports:     ${stats.reports}`);
  console.log(`  Conversions: ${stats.conversions}`);
  console.log(`  Skipped:     ${stats.skipped}`);
  console.log('═══════════════════════════════════════');
  console.log(`\nALL USERS now have temporary password: ${TEMP_PASSWORD}`);
  console.log('Inform all users to change their password after first login.\n');
}

run()
  .catch((err) => { console.error('Migration failed:', err); process.exit(1); })
  .finally(() => prisma.$disconnect());
