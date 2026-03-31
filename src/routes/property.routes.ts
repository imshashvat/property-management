import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest, logAudit } from '../middleware/auth';

const router = Router();

// GET /api/properties — list all properties
router.get('/', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const properties = db.prepare('SELECT * FROM properties WHERE is_deleted = 0 ORDER BY created_at DESC').all();
    // Add flat counts
    const result = properties.map((p: any) => {
      const stats = db.prepare(`
        SELECT 
          COUNT(*) as total_flats,
          SUM(CASE WHEN status = 'Occupied' THEN 1 ELSE 0 END) as occupied,
          SUM(CASE WHEN status = 'Vacant' THEN 1 ELSE 0 END) as vacant,
          SUM(CASE WHEN status = 'Under Maintenance' THEN 1 ELSE 0 END) as under_maintenance
        FROM flats WHERE property_id = ? AND is_deleted = 0
      `).get(p.id) as any;
      return { ...p, ...stats };
    });
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/properties — create property
router.post('/', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { name, address, code, description } = req.body;
    if (!name || !address || !code) {
      res.status(400).json({ error: 'Name, address, and code are required.' });
      return;
    }

    // Check code uniqueness
    const existing = db.prepare('SELECT id FROM properties WHERE code = ? AND is_deleted = 0').get(code.toUpperCase());
    if (existing) {
      res.status(409).json({ error: 'Property code already exists.' });
      return;
    }

    const result = db.prepare(
      'INSERT INTO properties (name, address, code, description, admin_id) VALUES (?, ?, ?, ?, ?)'
    ).run(name, address, code.toUpperCase(), description || '', req.user!.userId);

    logAudit(req.user!.userId, 'CREATE', 'property', Number(result.lastInsertRowid), `Created property: ${name}`);

    const property = db.prepare('SELECT * FROM properties WHERE id = ?').get(result.lastInsertRowid);
    res.status(201).json(property);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/properties/:id — update property
router.put('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { name, address, description } = req.body;
    const { id } = req.params;

    const existing: any = db.prepare('SELECT * FROM properties WHERE id = ? AND is_deleted = 0').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    db.prepare('UPDATE properties SET name = ?, address = ?, description = ?, updated_at = ? WHERE id = ?')
      .run(name || existing.name, address || existing.address, description !== undefined ? description : existing.description, new Date().toISOString(), id);

    logAudit(req.user!.userId, 'UPDATE', 'property', Number(id), `Updated property: ${name || existing.name}`);

    const updated = db.prepare('SELECT * FROM properties WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/properties/:id — soft delete
router.delete('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const existing: any = db.prepare('SELECT * FROM properties WHERE id = ? AND is_deleted = 0').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Property not found.' });
      return;
    }

    db.prepare('UPDATE properties SET is_deleted = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), id);

    logAudit(req.user!.userId, 'DELETE', 'property', Number(id), `Deleted property: ${existing.name}`);

    res.json({ message: 'Property deleted successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
