import { Pool, QueryResult, QueryResultRow } from 'pg';

// Serverless-optimized pool configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('localhost') ? false : { rejectUnauthorized: false },
  max: 5,                  // Limit connections for serverless
  idleTimeoutMillis: 10000, // Close idle connections quickly
  connectionTimeoutMillis: 10000,
});

export const db = {
  /**
   * Main query helper for standard data fetching
   */
  async query<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<QueryResult<T>> {
    const start = Date.now();
    const res = await pool.query<T>(text, params);
    const duration = Date.now() - start;
    if (process.env.NODE_ENV !== 'production') {
      console.log('SQL Query:', { text: text.substring(0, 80), duration, rows: res.rowCount });
    }
    return res;
  },

  /**
   * Helper for row-based results
   */
  async fetchOne<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T | null> {
    const res = await this.query<T>(text, params);
    return res.rows[0] || null;
  },

  async fetchAll<T extends QueryResultRow = any>(
    text: string,
    params?: any[]
  ): Promise<T[]> {
    const res = await this.query<T>(text, params);
    return res.rows;
  },

  /**
   * Helper for transactions
   */
  async transaction<T>(callback: (client: any) => Promise<T>): Promise<T> {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }
  },

  /**
   * Initialize database schema (auto-runs on first connection)
   */
  async initSchema(): Promise<void> {
    try {
      // Check if schema is already initialized by looking for User table
      const check = await pool.query(
        `SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'User') as exists`
      );
      if (check.rows[0].exists) return;

      console.log('Initializing database schema...');
      await pool.query(SCHEMA_SQL);
      console.log('Database schema initialized successfully!');
    } catch (err) {
      console.error('Schema initialization error:', err);
    }
  }
};

// Embedded schema SQL for Vercel compatibility (no file system reads)
const SCHEMA_SQL = `
-- PostgreSQL Schema for Property Management System

-- 1. Users Table
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

-- 2. Property Table
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

-- 3. Flat Table
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

-- 4. Tenant Table
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

-- 5. Assignment Table
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

-- 6. Payment Table
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

-- 7. MaintenanceRequest Table
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

-- 8. Notification Table
CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT PRIMARY KEY,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" TEXT DEFAULT 'INFO',
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

-- 9. Message Table
CREATE TABLE IF NOT EXISTS "Message" (
    "id" TEXT PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "isRead" BOOLEAN DEFAULT false,
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "senderId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE,
    "receiverId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE
);

-- 10. Announcement Table
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

-- 11. AuditLog Table
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

-- 12. Feedback Table
CREATE TABLE IF NOT EXISTS "Feedback" (
    "id" TEXT PRIMARY KEY,
    "rating" INTEGER NOT NULL,
    "comment" TEXT,
    "category" TEXT DEFAULT 'GENERAL',
    "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id") ON DELETE CASCADE
);

-- 13. Visitor Table
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

-- Auto-update updatedAt trigger
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
`;
