import { Router, Response } from 'express';
import db from '../db/database';
import {
  authMiddleware, adminOnly, AuthRequest, logAudit,
  hashPassword, generateCredentialId, generateTempPassword
} from '../middleware/auth';

const router = Router();

// GET /api/tenants — list all tenants
router.get('/', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const tenants = db.prepare(`
      SELECT t.*, u.credential_id, u.email as login_email, u.is_active, u.must_reset_password, u.last_login
      FROM tenants t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.is_deleted = 0
      ORDER BY t.created_at DESC
    `).all();

    // Add current assignment info
    const result = (tenants as any[]).map((t: any) => {
      const assignment: any = db.prepare(`
        SELECT a.*, f.flat_number, f.building_name, p.name as property_name
        FROM assignments a
        JOIN flats f ON a.flat_id = f.id
        JOIN properties p ON f.property_id = p.id
        WHERE a.tenant_id = ? AND a.is_active = 1
      `).get(t.id);
      return { ...t, current_assignment: assignment || null };
    });

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/tenants/:id — get single tenant
router.get('/:id', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const tenant: any = db.prepare(`
      SELECT t.*, u.credential_id, u.email as login_email, u.is_active, u.last_login
      FROM tenants t
      LEFT JOIN users u ON t.user_id = u.id
      WHERE t.id = ? AND t.is_deleted = 0
    `).get(req.params.id);

    if (!tenant) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }

    // Get assignment history
    const assignments = db.prepare(`
      SELECT a.*, f.flat_number, p.name as property_name
      FROM assignments a
      JOIN flats f ON a.flat_id = f.id
      JOIN properties p ON f.property_id = p.id
      WHERE a.tenant_id = ?
      ORDER BY a.created_at DESC
    `).all(tenant.id);

    // Get payment history
    const payments = db.prepare(`
      SELECT p.*, a.flat_id, f.flat_number
      FROM payments p
      JOIN assignments a ON p.assignment_id = a.id
      JOIN flats f ON a.flat_id = f.id
      WHERE a.tenant_id = ?
      ORDER BY p.due_date DESC
    `).all(tenant.id);

    res.json({ ...tenant, assignments, payments });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/tenants — create tenant with credentials
router.post('/', authMiddleware as any, adminOnly as any, async (req: AuthRequest, res: Response) => {
  try {
    const { name, email, phone, emergency_contact, property_code } = req.body;

    if (!name || !email) {
      res.status(400).json({ error: 'Name and email are required.' });
      return;
    }

    // Check if email already exists in users
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      res.status(409).json({ error: 'Email already registered.' });
      return;
    }

    // Generate credential ID  
    const pCode = property_code || 'PROP';
    const credentialId = generateCredentialId(pCode);
    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    // Create user account
    const userResult = db.prepare(
      'INSERT INTO users (email, password_hash, role, credential_id, must_reset_password) VALUES (?, ?, ?, ?, 1)'
    ).run(email, passwordHash, 'tenant', credentialId);

    // Create tenant profile
    const tenantResult = db.prepare(
      'INSERT INTO tenants (user_id, name, email, phone, emergency_contact) VALUES (?, ?, ?, ?, ?)'
    ).run(userResult.lastInsertRowid, name, email, phone || '', emergency_contact || '');

    logAudit(req.user!.userId, 'CREATE', 'tenant', Number(tenantResult.lastInsertRowid), `Created tenant: ${name} (${credentialId})`);

    const tenant = db.prepare('SELECT * FROM tenants WHERE id = ?').get(tenantResult.lastInsertRowid);

    res.status(201).json({
      tenant,
      credentials: {
        credentialId,
        temporaryPassword: tempPassword,
        message: 'Share these credentials with the tenant. Password must be changed on first login.'
      }
    });
  } catch (error: any) {
    console.error('Create tenant error:', error);
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/tenants/:id — update tenant
router.put('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { name, phone, emergency_contact } = req.body;
    const { id } = req.params;

    const existing: any = db.prepare('SELECT * FROM tenants WHERE id = ? AND is_deleted = 0').get(id);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }

    db.prepare('UPDATE tenants SET name = ?, phone = ?, emergency_contact = ?, updated_at = ? WHERE id = ?')
      .run(name || existing.name, phone !== undefined ? phone : existing.phone,
        emergency_contact !== undefined ? emergency_contact : existing.emergency_contact,
        new Date().toISOString(), id);

    logAudit(req.user!.userId, 'UPDATE', 'tenant', Number(id), `Updated tenant: ${name || existing.name}`);

    const updated = db.prepare('SELECT * FROM tenants WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// DELETE /api/tenants/:id — soft deactivate
router.delete('/:id', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const existing: any = db.prepare('SELECT * FROM tenants WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existing) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }

    // Soft delete tenant
    db.prepare('UPDATE tenants SET is_deleted = 1, updated_at = ? WHERE id = ?')
      .run(new Date().toISOString(), req.params.id);

    // Deactivate user account
    if (existing.user_id) {
      db.prepare('UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?')
        .run(new Date().toISOString(), existing.user_id);
    }

    // Deactivate active assignments
    db.prepare('UPDATE assignments SET is_active = 0, updated_at = ? WHERE tenant_id = ? AND is_active = 1')
      .run(new Date().toISOString(), req.params.id);

    logAudit(req.user!.userId, 'DEACTIVATE', 'tenant', Number(req.params.id), `Deactivated tenant: ${existing.name}`);
    res.json({ message: 'Tenant deactivated successfully. Records preserved for audit.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/tenants/:id/reset-credentials — admin resets tenant password
router.post('/:id/reset-credentials', authMiddleware as any, adminOnly as any, async (req: AuthRequest, res: Response) => {
  try {
    const existing: any = db.prepare('SELECT * FROM tenants WHERE id = ? AND is_deleted = 0').get(req.params.id);
    if (!existing || !existing.user_id) {
      res.status(404).json({ error: 'Tenant not found.' });
      return;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await hashPassword(tempPassword);

    db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 1, updated_at = ? WHERE id = ?')
      .run(passwordHash, new Date().toISOString(), existing.user_id);

    logAudit(req.user!.userId, 'RESET_CREDENTIALS', 'tenant', Number(req.params.id), `Reset credentials for: ${existing.name}`);

    const user: any = db.prepare('SELECT credential_id FROM users WHERE id = ?').get(existing.user_id);

    res.json({
      credentialId: user.credential_id,
      temporaryPassword: tempPassword,
      message: 'Credentials reset. Share new password with tenant.'
    });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
