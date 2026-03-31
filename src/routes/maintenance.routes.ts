import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

// GET /api/maintenance
router.get('/', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { status, priority, flat_id } = req.query;
    let query = `SELECT m.*, t.name as tenant_name, f.flat_number, f.building_name,
      p.name as property_name, tech.name as technician_name
      FROM maintenance m JOIN tenants t ON m.tenant_id = t.id
      JOIN flats f ON m.flat_id = f.id JOIN properties p ON f.property_id = p.id
      LEFT JOIN technicians tech ON m.assigned_technician_id = tech.id WHERE 1=1`;
    const params: any[] = [];

    if (req.user!.role === 'tenant') {
      const tenant: any = db.prepare('SELECT id FROM tenants WHERE user_id = ?').get(req.user!.userId);
      if (tenant) { query += ' AND m.tenant_id = ?'; params.push(tenant.id); }
    }
    if (status) { query += ' AND m.status = ?'; params.push(status); }
    if (priority) { query += ' AND m.priority = ?'; params.push(priority); }
    if (flat_id) { query += ' AND m.flat_id = ?'; params.push(flat_id); }
    query += ' ORDER BY m.created_at DESC';

    res.json(db.prepare(query).all(...params));
  } catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/maintenance
router.post('/', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { title, description, priority, flat_id } = req.body;
    if (!title) { res.status(400).json({ error: 'Title is required.' }); return; }

    let tenantId: number; let flatId = flat_id;
    if (req.user!.role === 'tenant') {
      const tenant: any = db.prepare('SELECT id FROM tenants WHERE user_id = ?').get(req.user!.userId);
      if (!tenant) { res.status(404).json({ error: 'Tenant not found.' }); return; }
      tenantId = tenant.id;
      const assignment: any = db.prepare('SELECT flat_id FROM assignments WHERE tenant_id = ? AND is_active = 1').get(tenantId);
      if (!assignment) { res.status(400).json({ error: 'No active flat assignment.' }); return; }
      flatId = assignment.flat_id;
    } else {
      if (!flat_id) { res.status(400).json({ error: 'Flat ID required.' }); return; }
      const assignment: any = db.prepare('SELECT tenant_id FROM assignments WHERE flat_id = ? AND is_active = 1').get(flat_id);
      tenantId = assignment ? assignment.tenant_id : 0;
    }

    const result = db.prepare('INSERT INTO maintenance (flat_id, tenant_id, title, description, priority) VALUES (?, ?, ?, ?, ?)')
      .run(flatId, tenantId, title, description || '', priority || 'Medium');

    const adminUsers = db.prepare('SELECT id FROM users WHERE role = ?').all('admin') as any[];
    for (const admin of adminUsers) {
      db.prepare('INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(admin.id, 'maintenance', 'New Maintenance Request', `Request: ${title}`, 'maintenance', result.lastInsertRowid);
    }
    logAudit(req.user!.userId, 'CREATE', 'maintenance', Number(result.lastInsertRowid), `Maintenance: ${title}`);

    const request = db.prepare(`SELECT m.*, t.name as tenant_name, f.flat_number FROM maintenance m
      JOIN tenants t ON m.tenant_id = t.id JOIN flats f ON m.flat_id = f.id WHERE m.id = ?`).get(result.lastInsertRowid);
    res.status(201).json(request);
  } catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

// PUT /api/maintenance/:id
router.put('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { status, assigned_technician_id, labor_cost, parts_cost, admin_notes, priority } = req.body;
    const existing: any = db.prepare('SELECT * FROM maintenance WHERE id = ?').get(req.params.id);
    if (!existing) { res.status(404).json({ error: 'Not found.' }); return; }

    db.prepare(`UPDATE maintenance SET status=?, assigned_technician_id=?, labor_cost=?, parts_cost=?, admin_notes=?, priority=?, updated_at=? WHERE id=?`)
      .run(status||existing.status, assigned_technician_id??existing.assigned_technician_id, labor_cost??existing.labor_cost,
        parts_cost??existing.parts_cost, admin_notes??existing.admin_notes, priority||existing.priority, new Date().toISOString(), req.params.id);

    const tenant: any = db.prepare('SELECT user_id FROM tenants WHERE id = ?').get(existing.tenant_id);
    if (tenant?.user_id && status && status !== existing.status) {
      db.prepare('INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)')
        .run(tenant.user_id, 'maintenance', 'Maintenance Update', `"${existing.title}" is now ${status}.`, 'maintenance', req.params.id);
    }
    logAudit(req.user!.userId, 'UPDATE', 'maintenance', Number(req.params.id), `Updated: ${status||existing.status}`);

    const updated = db.prepare(`SELECT m.*, t.name as tenant_name, f.flat_number, tech.name as technician_name
      FROM maintenance m JOIN tenants t ON m.tenant_id = t.id JOIN flats f ON m.flat_id = f.id
      LEFT JOIN technicians tech ON m.assigned_technician_id = tech.id WHERE m.id = ?`).get(req.params.id);
    res.json(updated);
  } catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

// GET /api/maintenance/technicians/list
router.get('/technicians/list', authMiddleware as any, adminOnly as any, (_req: AuthRequest, res: Response) => {
  try { res.json(db.prepare('SELECT * FROM technicians ORDER BY name').all()); }
  catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/maintenance/technicians
router.post('/technicians', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, specialization } = req.body;
    if (!name) { res.status(400).json({ error: 'Name required.' }); return; }
    const result = db.prepare('INSERT INTO technicians (name, phone, specialization) VALUES (?, ?, ?)').run(name, phone||'', specialization||'');
    res.status(201).json(db.prepare('SELECT * FROM technicians WHERE id = ?').get(result.lastInsertRowid));
  } catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

// POST /api/maintenance/:id/feedback
router.post('/:id/feedback', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { rating, comment } = req.body;
    if (!rating || rating < 1 || rating > 5) { res.status(400).json({ error: 'Rating 1-5 required.' }); return; }
    const tenant: any = db.prepare('SELECT id FROM tenants WHERE user_id = ?').get(req.user!.userId);
    if (!tenant) { res.status(404).json({ error: 'Tenant not found.' }); return; }
    const existing = db.prepare('SELECT id FROM feedback WHERE maintenance_id = ? AND tenant_id = ?').get(req.params.id, tenant.id);
    if (existing) { res.status(400).json({ error: 'Already submitted.' }); return; }
    db.prepare('INSERT INTO feedback (maintenance_id, tenant_id, rating, comment) VALUES (?, ?, ?, ?)').run(req.params.id, tenant.id, rating, comment||'');
    res.status(201).json({ message: 'Feedback submitted.' });
  } catch (error: any) { res.status(500).json({ error: 'Server error.' }); }
});

export default router;
