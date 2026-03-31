import { Router, Response } from 'express';
import db from '../db/database';
import { authMiddleware, adminOnly, AuthRequest, logAudit } from '../middleware/auth';
import { v4 as uuidv4 } from 'uuid';

const router = Router();

// GET /api/rent — list rent payments
router.get('/', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { status, assignment_id, tenant_id } = req.query;
    let query = `
      SELECT p.*, a.tenant_id, a.flat_id, a.lease_start, a.lease_end,
             t.name as tenant_name, f.flat_number, f.building_name,
             pr.name as property_name
      FROM payments p
      JOIN assignments a ON p.assignment_id = a.id
      JOIN tenants t ON a.tenant_id = t.id
      JOIN flats f ON a.flat_id = f.id
      JOIN properties pr ON f.property_id = pr.id
      WHERE 1=1
    `;
    const params: any[] = [];

    // If tenant, only show own payments
    if (req.user!.role === 'tenant') {
      const tenant: any = db.prepare('SELECT id FROM tenants WHERE user_id = ?').get(req.user!.userId);
      if (tenant) {
        query += ' AND a.tenant_id = ?';
        params.push(tenant.id);
      }
    }

    if (status) {
      query += ' AND p.status = ?';
      params.push(status);
    }
    if (assignment_id) {
      query += ' AND p.assignment_id = ?';
      params.push(assignment_id);
    }
    if (tenant_id) {
      query += ' AND a.tenant_id = ?';
      params.push(tenant_id);
    }

    query += ' ORDER BY p.due_date DESC';

    const payments = db.prepare(query).all(...params);
    res.json(payments);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/rent/generate — generate monthly rent records for all active assignments
router.post('/generate', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const { month, year } = req.body;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();
    const dueDate = `${targetYear}-${String(targetMonth).padStart(2, '0')}-01`;

    const activeAssignments = db.prepare('SELECT * FROM assignments WHERE is_active = 1').all() as any[];
    let generated = 0;

    for (const assignment of activeAssignments) {
      // Check if payment already exists for this month
      const existing = db.prepare(
        `SELECT id FROM payments WHERE assignment_id = ? AND due_date LIKE ?`
      ).get(assignment.id, `${targetYear}-${String(targetMonth).padStart(2, '0')}%`);

      if (!existing) {
        const receiptNumber = `RCP-${targetYear}${String(targetMonth).padStart(2, '0')}-${uuidv4().substring(0, 8).toUpperCase()}`;
        db.prepare(
          `INSERT INTO payments (assignment_id, due_date, amount, status, receipt_number) VALUES (?, ?, ?, 'Pending', ?)`
        ).run(assignment.id, dueDate, assignment.rent_amount, receiptNumber);

        // Notify tenant
        const tenant: any = db.prepare('SELECT user_id FROM tenants WHERE id = ?').get(assignment.tenant_id);
        if (tenant?.user_id) {
          db.prepare(
            'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)'
          ).run(tenant.user_id, 'rent', 'Rent Due', `Your rent of ₹${assignment.rent_amount} is due on ${dueDate}.`);
        }

        generated++;
      }
    }

    logAudit(req.user!.userId, 'GENERATE', 'payment', null, `Generated ${generated} rent records for ${targetMonth}/${targetYear}`);
    res.json({ message: `Generated ${generated} rent records for ${targetMonth}/${targetYear}.` });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// PUT /api/rent/:id/pay — mark payment as paid
router.put('/:id/pay', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { gateway_ref, notes } = req.body;

    const payment: any = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    if (!payment) {
      res.status(404).json({ error: 'Payment not found.' });
      return;
    }

    if (payment.status === 'Paid') {
      res.status(400).json({ error: 'Payment already completed.' });
      return;
    }

    // If tenant, verify they own this payment
    if (req.user!.role === 'tenant') {
      const assignment: any = db.prepare('SELECT * FROM assignments WHERE id = ?').get(payment.assignment_id);
      const tenant: any = db.prepare('SELECT id FROM tenants WHERE user_id = ?').get(req.user!.userId);
      if (!tenant || assignment.tenant_id !== tenant.id) {
        res.status(403).json({ error: 'Access denied.' });
        return;
      }
    }

    db.prepare(`
      UPDATE payments SET status = 'Paid', payment_date = ?, gateway_ref = ?, notes = ? WHERE id = ?
    `).run(new Date().toISOString(), gateway_ref || `PAY-${uuidv4().substring(0, 8).toUpperCase()}`, notes || '', id);

    // Notify admin about payment
    const assignment: any = db.prepare('SELECT * FROM assignments WHERE id = ?').get(payment.assignment_id);
    const tenant: any = db.prepare('SELECT name FROM tenants WHERE id = ?').get(assignment.tenant_id);
    const adminUsers = db.prepare('SELECT id FROM users WHERE role = ?').all('admin') as any[];
    for (const admin of adminUsers) {
      db.prepare(
        'INSERT INTO notifications (user_id, type, title, body) VALUES (?, ?, ?, ?)'
      ).run(admin.id, 'payment', 'Payment Received', `${tenant.name} paid ₹${payment.amount} for flat assignment #${assignment.id}.`);
    }

    logAudit(req.user!.userId, 'PAY', 'payment', Number(id), `Payment of ₹${payment.amount} received`);

    const updated = db.prepare('SELECT * FROM payments WHERE id = ?').get(id);
    res.json(updated);
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/rent/mark-overdue — mark overdue payments
router.post('/mark-overdue', authMiddleware as any, adminOnly as any, (req: AuthRequest, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];
    const result = db.prepare(
      `UPDATE payments SET status = 'Overdue' WHERE status = 'Pending' AND due_date < ?`
    ).run(today);

    res.json({ message: `Marked ${result.changes} payments as overdue.` });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
