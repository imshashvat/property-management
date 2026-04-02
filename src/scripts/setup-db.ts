import { Client } from 'pg';
import * as dotenv from 'dotenv';

dotenv.config();

async function setupDatabase() {
  const connectionString = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('Error: DATABASE_URL is not defined in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false
  });

  try {
    console.log('Connecting to database...');
    await client.connect();

    console.log('Executing schema initialization...');
    // Use the same schema that's embedded in db.ts
    await client.query(`
      -- PostgreSQL Schema for Property Management System

      CREATE TABLE IF NOT EXISTS "User" (
          "id" TEXT PRIMARY KEY,
          "email" TEXT UNIQUE NOT NULL,
          "password" TEXT NOT NULL,
          "name" TEXT NOT NULL,
          "role" TEXT DEFAULT 'TENANT',
          "phone" TEXT,
          "avatar" TEXT,
          "isActive" BOOLEAN DEFAULT true,
          "mustResetPwd" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Property" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "address" TEXT NOT NULL,
          "city" TEXT NOT NULL,
          "state" TEXT NOT NULL,
          "zipCode" TEXT NOT NULL,
          "type" TEXT DEFAULT 'APARTMENT',
          "totalFlats" INTEGER DEFAULT 0,
          "amenities" TEXT,
          "description" TEXT,
          "image" TEXT,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "Flat" (
          "id" TEXT PRIMARY KEY,
          "flatNumber" TEXT NOT NULL,
          "floor" INTEGER DEFAULT 0,
          "bedrooms" INTEGER DEFAULT 1,
          "bathrooms" INTEGER DEFAULT 1,
          "area" DOUBLE PRECISION,
          "rentAmount" DOUBLE PRECISION NOT NULL,
          "depositAmount" DOUBLE PRECISION,
          "status" TEXT DEFAULT 'VACANT',
          "furnishing" TEXT DEFAULT 'UNFURNISHED',
          "description" TEXT,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "propertyId" TEXT NOT NULL REFERENCES "Property"("id") ON DELETE CASCADE,
          UNIQUE("propertyId", "flatNumber")
      );

      CREATE TABLE IF NOT EXISTS "Tenant" (
          "id" TEXT PRIMARY KEY,
          "credentialId" TEXT UNIQUE NOT NULL,
          "firstName" TEXT NOT NULL,
          "lastName" TEXT NOT NULL,
          "phone" TEXT NOT NULL,
          "emergencyContact" TEXT,
          "idProofType" TEXT,
          "idProofNumber" TEXT,
          "idProofUrl" TEXT,
          "moveInDate" TIMESTAMP,
          "isActive" BOOLEAN DEFAULT true,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "userId" TEXT UNIQUE NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Assignment" (
          "id" TEXT PRIMARY KEY,
          "startDate" TIMESTAMP NOT NULL,
          "endDate" TIMESTAMP,
          "rentAmount" DOUBLE PRECISION NOT NULL,
          "deposit" DOUBLE PRECISION DEFAULT 0,
          "isActive" BOOLEAN DEFAULT true,
          "status" TEXT DEFAULT 'ACTIVE',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
          "flatId" TEXT NOT NULL REFERENCES "Flat"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Payment" (
          "id" TEXT PRIMARY KEY,
          "amount" DOUBLE PRECISION NOT NULL,
          "dueDate" TIMESTAMP NOT NULL,
          "paidDate" TIMESTAMP,
          "status" TEXT DEFAULT 'PENDING',
          "paymentMethod" TEXT,
          "transactionId" TEXT,
          "month" INTEGER NOT NULL,
          "year" INTEGER NOT NULL,
          "lateFee" DOUBLE PRECISION DEFAULT 0,
          "notes" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
          "flatId" TEXT NOT NULL REFERENCES "Flat"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "MaintenanceRequest" (
          "id" TEXT PRIMARY KEY,
          "title" TEXT NOT NULL,
          "description" TEXT NOT NULL,
          "category" TEXT DEFAULT 'GENERAL',
          "priority" TEXT DEFAULT 'MEDIUM',
          "status" TEXT DEFAULT 'OPEN',
          "images" TEXT,
          "resolution" TEXT,
          "resolvedAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE,
          "flatId" TEXT NOT NULL REFERENCES "Flat"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Notification" (
          "id" TEXT PRIMARY KEY,
          "title" TEXT NOT NULL,
          "message" TEXT NOT NULL,
          "type" TEXT DEFAULT 'INFO',
          "isRead" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Message" (
          "id" TEXT PRIMARY KEY,
          "subject" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "isRead" BOOLEAN DEFAULT false,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
          "receiverId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Announcement" (
          "id" TEXT PRIMARY KEY,
          "title" TEXT NOT NULL,
          "content" TEXT NOT NULL,
          "priority" TEXT DEFAULT 'NORMAL',
          "isActive" BOOLEAN DEFAULT true,
          "expiresAt" TIMESTAMP,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS "AuditLog" (
          "id" TEXT PRIMARY KEY,
          "action" TEXT NOT NULL,
          "entity" TEXT NOT NULL,
          "entityId" TEXT,
          "details" TEXT,
          "ipAddress" TEXT,
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Feedback" (
          "id" TEXT PRIMARY KEY,
          "rating" INTEGER NOT NULL,
          "comment" TEXT,
          "category" TEXT DEFAULT 'GENERAL',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS "Visitor" (
          "id" TEXT PRIMARY KEY,
          "name" TEXT NOT NULL,
          "phone" TEXT,
          "purpose" TEXT NOT NULL,
          "visitDate" TIMESTAMP NOT NULL,
          "checkIn" TIMESTAMP,
          "checkOut" TIMESTAMP,
          "flatNumber" TEXT,
          "status" TEXT DEFAULT 'EXPECTED',
          "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          "updatedAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );

      CREATE OR REPLACE FUNCTION update_updated_at_column()
      RETURNS TRIGGER AS $$
      BEGIN
          NEW."updatedAt" = CURRENT_TIMESTAMP;
          RETURN NEW;
      END;
      $$ language 'plpgsql';

      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_user_updated_at') THEN
          CREATE TRIGGER update_user_updated_at BEFORE UPDATE ON "User" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_property_updated_at') THEN
          CREATE TRIGGER update_property_updated_at BEFORE UPDATE ON "Property" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_flat_updated_at') THEN
          CREATE TRIGGER update_flat_updated_at BEFORE UPDATE ON "Flat" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_tenant_updated_at') THEN
          CREATE TRIGGER update_tenant_updated_at BEFORE UPDATE ON "Tenant" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_assignment_updated_at') THEN
          CREATE TRIGGER update_assignment_updated_at BEFORE UPDATE ON "Assignment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_payment_updated_at') THEN
          CREATE TRIGGER update_payment_updated_at BEFORE UPDATE ON "Payment" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_maintenance_updated_at') THEN
          CREATE TRIGGER update_maintenance_updated_at BEFORE UPDATE ON "MaintenanceRequest" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_announcement_updated_at') THEN
          CREATE TRIGGER update_announcement_updated_at BEFORE UPDATE ON "Announcement" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_visitor_updated_at') THEN
          CREATE TRIGGER update_visitor_updated_at BEFORE UPDATE ON "Visitor" FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
        END IF;
      END $$;
    `);
    
    console.log('Database schema created successfully!');
  } catch (err) {
    console.error('Database setup failed:', err);
    process.exit(1);
  } finally {
    await client.end();
  }
}

setupDatabase();
