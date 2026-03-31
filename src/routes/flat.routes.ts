import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

// GET /api/flats — list flats (with filters)
router.get('/', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { property_id, status, search } = req.query;
    let query = `
      SELECT f.*, p.name as property_name, p.code as property_code
      FROM flats f 
      JOIN properties p ON f.property_id = p.id 
      WHERE f.is_deleted = 0
    `;
    const params: any[] = [];

    if (property_id) {
      query += ' AND f.property_id = ?';
      params.push(property_id);
    }
    if (status) {
      query += ' AND f.status = ?';
      params.push(status);
    }
    if (search) {
      query += ' AND (f.flat_number LIKE ? OR f.building_name LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
    }

    query += ' ORDER BY f.created_at DESC';

    const flats = db.prepare(query).all(...params);

    // Add current tenant info for occupied flats
    const result = flats.map((f: any) => {
      if (f.status === 'Occupied') {
        const assignment: any = db.prepare(`
          SELECT a.*, t.name as tenant_name, t.phone as tenant_phone 
          FROM assignments a 
          JOIN tenants t ON a.tenant_id = t.id 
          WHERE a.flat_id = ? AND a.is_active = 1
        `).get(f.id);
        return { ...f, current_assignment: assignment || null };
      }
      return { ...f, current_assignment: null };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/flats/:id — get single flat
router.get('/:id', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const flat: any = db.prepare(`
      SELECT f.*, p.name as property_name, p.code as property_code
      FROM flats f JOIN properties p ON f.property_id = p.id
      WHERE f.id = ? AND f.is_deleted = 0
    `).get(req.params.id);

    if (!flat) {
      res.status(404).json({ error: 'Flat not found.' });
      return;
    }

    // Get assignment history
    const assignments = db.prepare(`
      SELECT a.*, t.name as tenant_name 
      FROM assignments a 
      JOIN tenants t ON a.tenant_id = t.id 
      WHERE a.flat_id = ? ORDER BY a.created_at DESC
    `).all(flat.id);

    // Get maintenance history
    const maintenanceHistory = db.prepare(`
      SELECT * FROM maintenance WHERE flat_id = ? ORDER BY created_at DESC LIMIT 10
    `).all(flat.id);

    res.json({ ...flat, assignments, maintenanceHistory });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/flats — create flat
router.post('/', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { property_id, flat_number, building_name, floor, rent_amount, security_deposit, bedrooms, amenities } = req.body;

    if (!property_id || !flat_number || !rent_amount) {
      res.status(400).json({ error: 'Property, flat number, and rent amount are required.' });
      return;
    }

    // Verify property exists
    const property = db.prepare('SELECT id FROM properties WHERE id = ? AND is_deleted = 0').get(property_id);
    if (!property) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    // Check duplicate flat number in same property
    const dup = db.prepare('SELECT id FROM flats WHERE property_id = ? AND flat_number = ? AND is_deleted = 0').get(property_id, flat_number);
    if (dup) {
      res.status(409).json({ error: 'Flat number already exists in this property.' });
      return;
    }

    const result = db.prepare(
      `INSERT INTO flats (property_id, flat_number, building_name, floor, rent_amount, security_deposit, bedrooms, amenities, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'Vacant')`
    ).run(property_id, flat_number, building_name || '', floor || 0, rent_amount, security_deposit || 0, bedrooms || 1, amenities || '');

    logAudit(req.user!.userId, 'CREATE', 'flat', Number(result.lastInsertRowid), `Created flat: ${flat_number}`);

    const flat = db.prepare('SELECT * FROM flats WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(flat);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/flats/:id — update flat
router.put('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { flat_number, building_name, floor, rent_amount, security_deposit, bedrooms, amenities, status } = req.body;
    const { id } = req.params;

    const existing: any = db.prepare('SELECT * FROM flats WHERE id = ? AND is_deleted = 0').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Flat not found.' });
      return;
    }

    db.prepare(`
      UPDATE flats SET flat_number = ?, building_name = ?, floor = ?, rent_amount = ?, 
      security_deposit = ?, bedrooms = ?, amenities = ?, status = ?, updated_at = ? WHERE id = ?
    `).run(
      flat_number || existing.flat_number,
      building_name !== undefined ? building_name : existing.building_name,
      floor !== undefined ? floor : existing.floor,
      rent_amount || existing.rent_amount,
      security_deposit !== undefined ? security_deposit : existing.security_deposit,
      bedrooms || existing.bedrooms,
      amenities !== undefined ? amenities : existing.amenities,
      status || existing.status,
      new Date().toISOString(), id
    );

    logAudit(req.user!.userId, 'UPDATE', 'flat', Number(id), `Updated flat: ${flat_number || existing.flat_number}`);

    const updated = db.prepare('SELECT * FROM flats WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/flats/:id — soft delete
router.delete('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const existing: any = db.prepare('SELECT * FROM flats WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Flat not found.' });
      return;
    }
    if (existing.status === 'Occupied') {
      res.status(400).json({ error: 'Cannot delete an occupied flat. Vacate the tenant first.' });
      return;
    }

    db.prepare('UPDATE flats SET is_deleted = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);

    logAudit(req.user!.userId, 'DELETE', 'flat', Number(req.params.id), `Deleted flat: ${existing.flat_number}`);
    res.json({ message: 'Flat deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
