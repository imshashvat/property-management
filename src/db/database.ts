import Database from 'better-sqlite3';
import path from 'path';
import fs from 'fs';
import dotenv from 'dotenv';

dotenv.config();

const dbPath = process.env.DB_PATH || './data/pms.db';
const dbDir = path.dirname(dbPath);

if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable WAL mode for better performance
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

export function initializeDatabase(): void {
  db.exec(`
    -- Properties table
    CREATE TABLE IF NOT EXISTS properties (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      code TEXT NOT NULL UNIQUE,
      description TEXT DEFAULT '',
      admin_id INTEGER NOT NULL,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0
    );

    -- Flats table
    CREATE TABLE IF NOT EXISTS flats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER NOT NULL,
      flat_number TEXT NOT NULL,
      building_name TEXT DEFAULT '',
      floor INTEGER DEFAULT 0,
      rent_amount REAL NOT NULL,
      security_deposit REAL DEFAULT 0,
      bedrooms INTEGER DEFAULT 1,
      amenities TEXT DEFAULT '',
      status TEXT DEFAULT 'Vacant' CHECK(status IN ('Vacant', 'Occupied', 'Under Maintenance')),
      images TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (property_id) REFERENCES properties(id)
    );

    -- Users table (for authentication)
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin', 'tenant')),
      credential_id TEXT UNIQUE,
      is_active INTEGER DEFAULT 1,
      must_reset_password INTEGER DEFAULT 0,
      dark_mode INTEGER DEFAULT 0,
      two_factor_enabled INTEGER DEFAULT 0,
      two_factor_secret TEXT,
      last_login TEXT,
      last_login_ip TEXT,
      failed_login_attempts INTEGER DEFAULT 0,
      lockout_until TEXT,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now'))
    );

    -- Tenants table (personal info)
    CREATE TABLE IF NOT EXISTS tenants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      name TEXT NOT NULL,
      email TEXT NOT NULL,
      phone TEXT DEFAULT '',
      emergency_contact TEXT DEFAULT '',
      id_proof_path TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      is_deleted INTEGER DEFAULT 0,
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Assignments table (flat-tenant link)
    CREATE TABLE IF NOT EXISTS assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      tenant_id INTEGER NOT NULL,
      flat_id INTEGER NOT NULL,
      lease_start TEXT NOT NULL,
      lease_end TEXT NOT NULL,
      rent_amount REAL NOT NULL,
      security_deposit REAL DEFAULT 0,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (flat_id) REFERENCES flats(id)
    );

    -- Payments table
    CREATE TABLE IF NOT EXISTS payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      assignment_id INTEGER NOT NULL,
      due_date TEXT NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'Pending' CHECK(status IN ('Paid', 'Pending', 'Overdue')),
      payment_date TEXT,
      gateway_ref TEXT,
      invoice_path TEXT,
      receipt_number TEXT UNIQUE,
      late_fee REAL DEFAULT 0,
      notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (assignment_id) REFERENCES assignments(id)
    );

    -- Maintenance table
    CREATE TABLE IF NOT EXISTS maintenance (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      flat_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT DEFAULT '',
      priority TEXT DEFAULT 'Medium' CHECK(priority IN ('Low', 'Medium', 'High', 'Urgent')),
      status TEXT DEFAULT 'Open' CHECK(status IN ('Open', 'In Progress', 'Resolved', 'Closed')),
      assigned_technician_id INTEGER,
      images TEXT DEFAULT '',
      labor_cost REAL DEFAULT 0,
      parts_cost REAL DEFAULT 0,
      admin_notes TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      updated_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flat_id) REFERENCES flats(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id),
      FOREIGN KEY (assigned_technician_id) REFERENCES technicians(id)
    );

    -- Technicians table
    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT DEFAULT '',
      specialization TEXT DEFAULT '',
      is_available INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now'))
    );

    -- Documents table
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      entity_type TEXT NOT NULL,
      entity_id INTEGER NOT NULL,
      doc_type TEXT NOT NULL,
      file_name TEXT NOT NULL,
      storage_path TEXT NOT NULL,
      uploaded_by INTEGER NOT NULL,
      expiry_date TEXT,
      version INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (uploaded_by) REFERENCES users(id)
    );

    -- Messages table
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      receiver_id INTEGER NOT NULL,
      content TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      message_type TEXT DEFAULT 'text',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (sender_id) REFERENCES users(id),
      FOREIGN KEY (receiver_id) REFERENCES users(id)
    );

    -- Notifications table
    CREATE TABLE IF NOT EXISTS notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT DEFAULT '',
      related_entity_type TEXT,
      related_entity_id INTEGER,
      is_read INTEGER DEFAULT 0,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Announcements table
    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      property_id INTEGER,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      is_active INTEGER DEFAULT 1,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (property_id) REFERENCES properties(id),
      FOREIGN KEY (created_by) REFERENCES users(id)
    );

    -- Audit logs table
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER,
      action_type TEXT NOT NULL,
      entity_type TEXT NOT NULL,
      entity_id INTEGER,
      details TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      device_info TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    -- Feedback table
    CREATE TABLE IF NOT EXISTS feedback (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      maintenance_id INTEGER NOT NULL,
      tenant_id INTEGER NOT NULL,
      rating INTEGER NOT NULL CHECK(rating >= 1 AND rating <= 5),
      comment TEXT DEFAULT '',
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (maintenance_id) REFERENCES maintenance(id),
      FOREIGN KEY (tenant_id) REFERENCES tenants(id)
    );

    -- Visitors table
    CREATE TABLE IF NOT EXISTS visitors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT DEFAULT '',
      flat_visited_id INTEGER,
      purpose TEXT DEFAULT '',
      entry_time TEXT DEFAULT (datetime('now')),
      exit_time TEXT,
      photo_path TEXT DEFAULT '',
      logged_by INTEGER,
      created_at TEXT DEFAULT (datetime('now')),
      FOREIGN KEY (flat_visited_id) REFERENCES flats(id),
      FOREIGN KEY (logged_by) REFERENCES users(id)
    );

    -- Create indexes for performance
    CREATE INDEX IF NOT EXISTS idx_flats_property ON flats(property_id);
    CREATE INDEX IF NOT EXISTS idx_flats_status ON flats(status);
    CREATE INDEX IF NOT EXISTS idx_tenants_user ON tenants(user_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_tenant ON assignments(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_assignments_flat ON assignments(flat_id);
    CREATE INDEX IF NOT EXISTS idx_payments_assignment ON payments(assignment_id);
    CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);
    CREATE INDEX IF NOT EXISTS idx_maintenance_flat ON maintenance(flat_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_tenant ON maintenance(tenant_id);
    CREATE INDEX IF NOT EXISTS idx_maintenance_status ON maintenance(status);
    CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id);
    CREATE INDEX IF NOT EXISTS idx_messages_receiver ON messages(receiver_id);
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id);
    CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id);
  `);

  console.log('✅ Database initialized successfully');
}

export default db;
