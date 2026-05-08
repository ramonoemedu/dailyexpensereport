-- CreateTable
CREATE TABLE "users" (
    "uid" TEXT NOT NULL,
    "fullName" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "email" TEXT NOT NULL DEFAULT '',
    "loginEmail" TEXT NOT NULL DEFAULT '',
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "systemAdmin" BOOLEAN NOT NULL DEFAULT false,
    "families" JSONB NOT NULL DEFAULT '{}',
    "currentFamilyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("uid")
);

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_members" (
    "familyId" TEXT NOT NULL,
    "uid" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'member',
    "fullName" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "addedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "family_members_pkey" PRIMARY KEY ("familyId","uid")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "type" TEXT NOT NULL DEFAULT 'Expense',
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL DEFAULT '',
    "paymentMethod" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'active',
    "importRef" TEXT NOT NULL DEFAULT '',
    "extraData" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_settings" (
    "familyId" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_settings_pkey" PRIMARY KEY ("familyId")
);

-- CreateTable
CREATE TABLE "family_reports" (
    "familyId" TEXT NOT NULL,
    "reportKey" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_reports_pkey" PRIMARY KEY ("familyId","reportKey")
);

-- CreateTable
CREATE TABLE "pdf_conversions" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "data" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdf_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "users_userId_key" ON "users"("userId");

-- CreateIndex
CREATE INDEX "expenses_familyId_date_idx" ON "expenses"("familyId", "date");

-- CreateIndex
CREATE INDEX "pdf_conversions_userId_idx" ON "pdf_conversions"("userId");

-- AddForeignKey
ALTER TABLE "family_members" ADD CONSTRAINT "family_members_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_settings" ADD CONSTRAINT "family_settings_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_reports" ADD CONSTRAINT "family_reports_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
