import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/dashboard/admin
router.get('/admin', authMiddleware as any, adminOnly as any, (_req: AuthRequest, res: Response) => {
  try {
    const totalProperties = (db.prepare('SELECT COUNT(*) as c FROM properties WHERE is_deleted=0').get() as any).c;
    const totalFlats = (db.prepare('SELECT COUNT(*) as c FROM flats WHERE is_deleted=0').get() as any).c;
    const occupiedFlats = (db.prepare("SELECT COUNT(*) as c FROM flats WHERE status='Occupied' AND is_deleted=0").get() as any).c;
    const vacantFlats = (db.prepare("SELECT COUNT(*) as c FROM flats WHERE status='Vacant' AND is_deleted=0").get() as any).c;
    const totalTenants = (db.prepare('SELECT COUNT(*) as c FROM tenants WHERE is_deleted=0').get() as any).c;
    const activeTenants = (db.prepare('SELECT COUNT(DISTINCT tenant_id) as c FROM assignments WHERE is_active=1').get() as any).c;
    const occupancyRate = totalFlats > 0 ? Math.round((occupiedFlats / totalFlats) * 100) : 0;

    // Payment stats
    const totalPending = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='Pending'").get() as any).s;
    const totalOverdue = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='Overdue'").get() as any).s;
    const totalCollected = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='Paid'").get() as any).s;
    const pendingCount = (db.prepare("SELECT COUNT(*) as c FROM payments WHERE status='Pending'").get() as any).c;
    const overdueCount = (db.prepare("SELECT COUNT(*) as c FROM payments WHERE status='Overdue'").get() as any).c;

    // Monthly income (current month)
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
    const monthlyIncome = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='Paid' AND payment_date LIKE ?").get(`${monthKey}%`) as any).s;

    // Maintenance stats
    const openMaint = (db.prepare("SELECT COUNT(*) as c FROM maintenance WHERE status='Open'").get() as any).c;
    const inProgressMaint = (db.prepare("SELECT COUNT(*) as c FROM maintenance WHERE status='In Progress'").get() as any).c;
    const resolvedMaint = (db.prepare("SELECT COUNT(*) as c FROM maintenance WHERE status='Resolved' OR status='Closed'").get() as any).c;

    // Lease expiring in 30 days
    const thirtyDaysFromNow = new Date(Date.now() + 30*24*60*60*1000).toISOString().split('T')[0];
    const expiringLeases = db.prepare(`SELECT a.*, t.name as tenant_name, f.flat_number, p.name as property_name
      FROM assignments a JOIN tenants t ON a.tenant_id=t.id JOIN flats f ON a.flat_id=f.id JOIN properties p ON f.property_id=p.id
      WHERE a.is_active=1 AND a.lease_end <= ? ORDER BY a.lease_end`).all(thirtyDaysFromNow);

    // Recent payments
    const recentPayments = db.prepare(`SELECT p.*, t.name as tenant_name, f.flat_number
      FROM payments p JOIN assignments a ON p.assignment_id=a.id JOIN tenants t ON a.tenant_id=t.id JOIN flats f ON a.flat_id=f.id
      WHERE p.status='Paid' ORDER BY p.payment_date DESC LIMIT 5`).all();

    // Recent maintenance
    const recentMaintenance = db.prepare(`SELECT m.*, t.name as tenant_name, f.flat_number
      FROM maintenance m JOIN tenants t ON m.tenant_id=t.id JOIN flats f ON m.flat_id=f.id
      ORDER BY m.created_at DESC LIMIT 5`).all();

    // Monthly income chart data (last 6 months)
    const incomeChart: {month: string, amount: number}[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const mk = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
      const amt = (db.prepare("SELECT COALESCE(SUM(amount),0) as s FROM payments WHERE status='Paid' AND payment_date LIKE ?").get(`${mk}%`) as any).s;
      incomeChart.push({ month: mk, amount: amt });
    }

    res.json({
      totalProperties, totalFlats, occupiedFlats, vacantFlats, totalTenants, activeTenants, occupancyRate,
      totalPending, totalOverdue, totalCollected, pendingCount, overdueCount, monthlyIncome,
      openMaint, inProgressMaint, resolvedMaint,
      expiringLeases, recentPayments, recentMaintenance, incomeChart
    });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/dashboard/tenant
router.get('/tenant', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const tenant: any = db.prepare('SELECT * FROM tenants WHERE user_id = ? AND is_deleted = 0').get(req.user!.userId);
    if (!tenant) { res.status(404).json({ error: 'Tenant not found.' }); return; }

    const assignment: any = db.prepare(`SELECT a.*, f.flat_number, f.building_name, f.floor, f.bedrooms, f.amenities,
      p.name as property_name, p.address as property_address
      FROM assignments a JOIN flats f ON a.flat_id=f.id JOIN properties p ON f.property_id=p.id
      WHERE a.tenant_id=? AND a.is_active=1`).get(tenant.id);

    const payments = db.prepare(`SELECT p.* FROM payments p JOIN assignments a ON p.assignment_id=a.id
      WHERE a.tenant_id=? ORDER BY p.due_date DESC LIMIT 12`).all(tenant.id);

    const maintenanceRequests = db.prepare(`SELECT * FROM maintenance WHERE tenant_id=? ORDER BY created_at DESC LIMIT 10`).all(tenant.id);

    const notifications = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 20').all(req.user!.userId);
    const unreadNotifs = (db.prepare('SELECT COUNT(*) as c FROM notifications WHERE user_id=? AND is_read=0').get(req.user!.userId) as any).c;

    const announcements = assignment ? db.prepare(`SELECT * FROM announcements WHERE (property_id=? OR property_id IS NULL) AND is_active=1 ORDER BY created_at DESC LIMIT 5`)
      .all((db.prepare('SELECT property_id FROM flats WHERE id=?').get(assignment.flat_id) as any)?.property_id) : [];

    res.json({ tenant, assignment, payments, maintenanceRequests, notifications, unreadNotifs, announcements });
  } catch (error: any) { console.error(error); res.status(500).json({ error: 'Server error.' }); }
});

// Notification routes
// GET /api/notifications
router.get('/notifications', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const notifs = db.prepare('SELECT * FROM notifications WHERE user_id=? ORDER BY created_at DESC LIMIT 50').all(req.user!.userId);
    res.json(notifs);
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/notifications/:id/read
router.put('/notifications/:id/read', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE id=? AND user_id=?').run(req.params.id, req.user!.userId);
    res.json({ message: 'Marked as read.' });
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/notifications/read-all
router.put('/notifications/read-all', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    db.prepare('UPDATE notifications SET is_read=1 WHERE user_id=?').run(req.user!.userId);
    res.json({ message: 'All marked as read.' });
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

// Announcements
router.get('/announcements', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { property_id } = req.query;
    let q = 'SELECT a.*, u.email as author_email FROM announcements a JOIN users u ON a.created_by=u.id WHERE a.is_active=1';
    const p: any[] = [];
    if (property_id) { q += ' AND a.property_id=?'; p.push(property_id); }
    q += ' ORDER BY a.created_at DESC';
    res.json(db.prepare(q).all(...p));
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

router.post('/announcements', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { property_id, title, body } = req.body;
    if (!title || !body) { res.status(400).json({ error: 'Title and body required.' }); return; }
    const result = db.prepare('INSERT INTO announcements (property_id, title, body, created_by) VALUES (?, ?, ?, ?)')
      .run(property_id || null, title, body, req.user!.userId);
    res.status(201).json(db.prepare('SELECT * FROM announcements WHERE id=?').get(result.lastInsertRowid));
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

// Audit logs
router.get('/audit-logs', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { user_id, entity_type, limit: lim } = req.query;
    let q = `SELECT al.*, u.email as user_email FROM audit_logs al LEFT JOIN users u ON al.user_id=u.id WHERE 1=1`;
    const p: any[] = [];
    if (user_id) { q += ' AND al.user_id=?'; p.push(user_id); }
    if (entity_type) { q += ' AND al.entity_type=?'; p.push(entity_type); }
    q += ` ORDER BY al.created_at DESC LIMIT ?`;
    p.push(lim || 100);
    res.json(db.prepare(q).all(...p));
  } catch (e) { res.status(500).json({ error: 'Server error.' }); }
});

export default router;
