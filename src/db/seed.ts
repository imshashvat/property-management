import bcrypt from 'bcryptjs';
import db, { initializeDatabase } from './database';
import dotenv from 'dotenv';

dotenv.config();

async function seed() {
  console.log('🌱 Seeding database...');
  initializeDatabase();

  // Clear existing data
  const tables = ['feedback','visitors','audit_logs','announcements','notifications','messages','documents','maintenance','payments','assignments','technicians','tenants','users','flats','properties'];
  for (const t of tables) { db.prepare(`DELETE FROM ${t}`).run(); }

  // Create admin user
  const adminHash = await bcrypt.hash('Admin@123', 12);
  const adminResult = db.prepare(`INSERT INTO users (email, password_hash, role, is_active, must_reset_password) VALUES (?, ?, 'admin', 1, 0)`).run('admin@pms.com', adminHash);
  const adminId = Number(adminResult.lastInsertRowid);

  // Create properties
  const p1 = db.prepare(`INSERT INTO properties (name, address, code, description, admin_id) VALUES (?, ?, ?, ?, ?)`).run('Maple Residency', '123 Oak Street, Downtown', 'MAPLE', 'Premium residential complex with modern amenities', adminId);
  const p2 = db.prepare(`INSERT INTO properties (name, address, code, description, admin_id) VALUES (?, ?, ?, ?, ?)`).run('Sunrise Apartments', '456 Park Avenue, Westside', 'SUNRISE', 'Affordable housing with great connectivity', adminId);
  const propId1 = Number(p1.lastInsertRowid);
  const propId2 = Number(p2.lastInsertRowid);

  // Create flats
  const flatsData = [
    [propId1,'A-101','Block A',1,25000,50000,2,'WiFi, Parking, Gym'],
    [propId1,'A-102','Block A',1,22000,44000,1,'WiFi, Parking'],
    [propId1,'B-201','Block B',2,28000,56000,3,'WiFi, Parking, Gym, Pool'],
    [propId1,'B-202','Block B',2,26000,52000,2,'WiFi, Parking, Gym'],
    [propId1,'C-301','Block C',3,30000,60000,3,'WiFi, Parking, Gym, Pool, Garden'],
    [propId2,'101','Main',1,15000,30000,1,'WiFi'],
    [propId2,'102','Main',1,15000,30000,1,'WiFi'],
    [propId2,'201','Main',2,18000,36000,2,'WiFi, Parking'],
    [propId2,'202','Main',2,18000,36000,2,'WiFi, Parking'],
    [propId2,'301','Main',3,20000,40000,2,'WiFi, Parking, Gym'],
  ];
  const flatIds: number[] = [];
  for (const f of flatsData) {
    const r = db.prepare(`INSERT INTO flats (property_id,flat_number,building_name,floor,rent_amount,security_deposit,bedrooms,amenities,status) VALUES (?,?,?,?,?,?,?,?,'Vacant')`).run(...f);
    flatIds.push(Number(r.lastInsertRowid));
  }

  // Create tenants with credentials
  const tenantHash = await bcrypt.hash('Tenant@123', 12);
  const tenantsData = [
    { name:'Rahul Sharma', email:'rahul@demo.com', phone:'9876543210', ec:'9876543211', cred:'TNT-MAPLE-2024-001' },
    { name:'Priya Patel', email:'priya@demo.com', phone:'9876543220', ec:'9876543221', cred:'TNT-MAPLE-2024-002' },
    { name:'Amit Kumar', email:'amit@demo.com', phone:'9876543230', ec:'9876543231', cred:'TNT-SUNRISE-2024-001' },
    { name:'Sneha Reddy', email:'sneha@demo.com', phone:'9876543240', ec:'9876543241', cred:'TNT-SUNRISE-2024-002' },
  ];
  const tenantIds: number[] = [];
  for (const t of tenantsData) {
    const uRes = db.prepare(`INSERT INTO users (email,password_hash,role,credential_id,is_active,must_reset_password) VALUES (?,'${tenantHash}','tenant',?,1,0)`).run(t.email, t.cred);
    const tRes = db.prepare(`INSERT INTO tenants (user_id,name,email,phone,emergency_contact) VALUES (?,?,?,?,?)`).run(uRes.lastInsertRowid, t.name, t.email, t.phone, t.ec);
    tenantIds.push(Number(tRes.lastInsertRowid));
  }

  // Create assignments (first 4 flats occupied)
  const assignData = [
    [tenantIds[0], flatIds[0], '2024-01-01', '2025-12-31', 25000, 50000],
    [tenantIds[1], flatIds[2], '2024-03-01', '2025-02-28', 28000, 56000],
    [tenantIds[2], flatIds[5], '2024-06-01', '2025-05-31', 15000, 30000],
    [tenantIds[3], flatIds[7], '2024-04-01', '2025-03-31', 18000, 36000],
  ];
  const assignIds: number[] = [];
  for (const a of assignData) {
    const r = db.prepare('INSERT INTO assignments (tenant_id,flat_id,lease_start,lease_end,rent_amount,security_deposit,is_active) VALUES (?,?,?,?,?,?,1)').run(...a);
    assignIds.push(Number(r.lastInsertRowid));
    db.prepare("UPDATE flats SET status='Occupied' WHERE id=?").run(a[1]);
  }

  // Create payment records
  const months = ['2024-10','2024-11','2024-12','2025-01','2025-02','2025-03'];
  for (const aIdx of [0,1,2,3]) {
    const amt = assignData[aIdx][4] as number;
    for (const m of months) {
      const status = m <= '2025-01' ? 'Paid' : (m === '2025-02' ? 'Paid' : 'Pending');
      const payDate = status === 'Paid' ? `${m}-05` : null;
      const rcpt = `RCP-${m.replace('-','')}-${String(aIdx+1).padStart(4,'0')}`;
      db.prepare('INSERT INTO payments (assignment_id,due_date,amount,status,payment_date,receipt_number) VALUES (?,?,?,?,?,?)')
        .run(assignIds[aIdx], `${m}-01`, amt, status, payDate, rcpt);
    }
  }

  // Create maintenance requests
  const maintData = [
    [flatIds[0], tenantIds[0], 'Leaking Faucet', 'Kitchen faucet dripping constantly', 'Medium', 'Resolved'],
    [flatIds[0], tenantIds[0], 'AC Not Cooling', 'Living room AC blowing warm air', 'High', 'In Progress'],
    [flatIds[2], tenantIds[1], 'Broken Window Lock', 'Bedroom window lock is jammed', 'Low', 'Open'],
    [flatIds[5], tenantIds[2], 'Power Outlet Issue', 'Outlet in bathroom not working', 'High', 'Open'],
    [flatIds[7], tenantIds[3], 'Water Heater Malfunction', 'No hot water since morning', 'Urgent', 'In Progress'],
  ];
  for (const m of maintData) {
    db.prepare('INSERT INTO maintenance (flat_id,tenant_id,title,description,priority,status) VALUES (?,?,?,?,?,?)').run(...m);
  }

  // Create technicians
  db.prepare("INSERT INTO technicians (name,phone,specialization) VALUES ('Rajesh Kumar','9988776655','Plumbing')").run();
  db.prepare("INSERT INTO technicians (name,phone,specialization) VALUES ('Suresh Yadav','9988776656','Electrical')").run();
  db.prepare("INSERT INTO technicians (name,phone,specialization) VALUES ('Vikram Singh','9988776657','HVAC')").run();

  // Create announcements
  db.prepare('INSERT INTO announcements (property_id,title,body,created_by) VALUES (?,?,?,?)').run(propId1, 'Water Supply Maintenance', 'Water supply will be interrupted on March 25th from 10 AM to 2 PM for tank cleaning.', adminId);
  db.prepare('INSERT INTO announcements (property_id,title,body,created_by) VALUES (?,?,?,?)').run(null, 'Festival Greetings', 'Wishing all residents a Happy Holi! Office will remain closed on March 14th.', adminId);

  // Set one flat under maintenance
  db.prepare("UPDATE flats SET status='Under Maintenance' WHERE id=?").run(flatIds[4]);

  console.log('✅ Seed data created successfully!');
  console.log('\n📋 Login Credentials:');
  console.log('   Admin:  admin@pms.com / Admin@123');
  console.log('   Tenant: TNT-MAPLE-2024-001 / Tenant@123 (Rahul Sharma)');
  console.log('   Tenant: TNT-MAPLE-2024-002 / Tenant@123 (Priya Patel)');
  console.log('   Tenant: TNT-SUNRISE-2024-001 / Tenant@123 (Amit Kumar)');
  console.log('   Tenant: TNT-SUNRISE-2024-002 / Tenant@123 (Sneha Reddy)');
}

seed().catch(console.error);
