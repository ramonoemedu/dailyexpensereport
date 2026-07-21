import { PrismaClient } from '@prisma/client';
import bcryptjs from 'bcryptjs';
const { hash } = bcryptjs;
import { randomUUID } from 'crypto';

const prisma = new PrismaClient();

const username = 'ramonoem';
const email = 'ramonoem@gmail.com';
const password = 'changeme!';

const passwordHash = await hash(password, 12);
const now = new Date();

const user = await prisma.user.upsert({
  where: { username },
  update: { passwordHash, email, loginEmail: email, status: 'active', updatedAt: now },
  create: {
    uid: randomUUID(),
    fullName: 'Ramon Oem',
    username,
    userId: username,
    email,
    loginEmail: email,
    passwordHash,
    status: 'active',
    families: {},
    createdAt: now,
    updatedAt: now,
  },
});

console.log('User ready:', { username: user.username, email: user.email, uid: user.uid });
await prisma.$disconnect();
