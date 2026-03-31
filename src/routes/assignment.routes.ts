import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

// GET /api/assignments — list assignments
router.get('/', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { active_only } = req.query;
    let query = `
      SELECT a.*, t.name as tenant_name, t.email as tenant_email, t.phone as tenant_phone,
             f.flat_number, f.building_name, f.floor, p.name as property_name, p.code as property_code
      FROM assignments a
      JOIN tenants t ON a.tenant_id = t.id
      JOIN flats f ON a.flat_id = f.id
      JOIN properties p ON f.property_id = p.id
    `;
    if (active_only === 'true') query += ' WHERE a.is_active = 1';
    query += ' ORDER BY a.created_at DESC';

    const assignments = db.prepare(query).all();
    res.json(assignments);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/assignments — create assignment
router.post('/', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { tenant_id, flat_id, lease_start, lease_end, rent_amount, security_deposit } = req.body;

    if (!tenant_id || !flat_id || !lease_start || !lease_end || !rent_amount) {
      res.status(400).json({ error: 'Tenant, flat, lease dates, and rent amount are required.' });
      return;
    }

    // Check flat is vacant
    const flat: any = db.prepare('SELECT * FROM flats WHERE id = ? AND is_deleted = 0').get(flat_id);
    if (!flat) {
      res.status(404).json({ error: 'Flat not found.' });
      return;
    }
    if (flat.status === 'Occupied') {
      res.status(400).json({ error: 'Flat is already occupied.' });
      return;
    }

    // Check tenant exists
    const tenant: any = db.prepare('SELECT * FROM tenants WHERE id = ? AND is_deleted = 0').get(tenant_id);
    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }

    // Check tenant doesn't already have an active assignment
    const activeAssignment = db.prepare('SELECT id FROM assignments WHERE tenant_id = ? AND is_active = 1').get(tenant_id);
    if (activeAssignment) {
      res.status(400).json({ error: 'Tenant already has an active assignment. Vacate first.' });
      return;
    }

    // Create assignment
    const result = db.prepare(
      'INSERT INTO assignments (tenant_id, flat_id, lease_start, lease_end, rent_amount, security_deposit) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(tenant_id, flat_id, lease_start, lease_end, rent_amount, security_deposit || 0);

    // Update flat status to Occupied
    db.prepare('UPDATE flats SET status = ?, updated_at = ? WHERE id = ?')
      .run('Occupied', new Date().toISOString(), flat_id);

    // Create notification for tenant
    if (tenant.user_id) {
      db.prepare(
        'INSERT INTO notifications (user_id, type, title, body, related_entity_type, related_entity_id) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(tenant.user_id, 'assignment', 'New Flat Assignment', `You have been assigned to flat ${flat.flat_number}. Lease starts ${lease_start}.`, 'assignment', result.lastInsertRowid);
    }

    logAudit(req.user!.userId, 'CREATE', 'assignment', Number(result.lastInsertRowid), `Assigned ${tenant.name} to flat ${flat.flat_number}`);

    const assignment = db.prepare(`
      SELECT a.*, t.name as tenant_name, f.flat_number, p.name as property_name
      FROM assignments a
      JOIN tenants t ON a.tenant_id = t.id
      JOIN flats f ON a.flat_id = f.id
      JOIN properties p ON f.property_id = p.id
      WHERE a.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json(assignment);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/assignments/:id/vacate — vacate assignment
router.put('/:id/vacate', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const assignment: any = db.prepare('SELECT * FROM assignments WHERE id = ? AND is_active = 1').get(id);
    if (!assignment) {
      res.status(404).json({ error: 'Active assignment not found.' });
      return;
    }

    // Deactivate assignment
    db.prepare('UPDATE assignments SET is_active = 0, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    // Set flat to vacant
    db.prepare('UPDATE flats SET status = ?, updated_at = ? WHERE id = ?')
      .run('Vacant', new Date().toISOString(), assignment.flat_id);

    // Notification
    const tenant: any = db.prepare('SELECT * FROM tenants WHERE id = ?').get(assignment.tenant_id);
    if (tenant?.user_id) {
      db.prepare(
        'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)'
      ).run(tenant.user_id, 'vacate', 'Flat Vacated', 'Your flat assignment has been ended.');
    }

    logAudit(req.user!.userId, 'VACATE', 'assignment', Number(id), `Vacated assignment #${id}`);

    res.json({ message: 'Assignment vacated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
