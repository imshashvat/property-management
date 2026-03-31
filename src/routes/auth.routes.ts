import { Router, Request, Response } from 'express';
import db from '../db/database';
import {
  hashPassword, comparePassword, generateAccessToken, generateRefreshToken,
  verifyRefreshToken, authMiddleware, AuthRequest, logAudit
} from '../middleware/auth';

const router = Router();

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, credentialId, password } = req.body;

    if (!password || (!email && !credentialId)) {
      res.status(400).json({ error: 'Email/Credential ID and password are required.' });
      return;
    }

    // Find user by email or credential ID
    let user: any;
    if (email) {
      user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    } else {
      user = db.prepare('SELECT * FROM users WHERE credential_id = ?').get(credentialId);
    }

    if (!user) {
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    // Check if account is active
    if (!user.is_active) {
      res.status(401).json({ error: 'Account is deactivated. Contact your administrator.' });
      return;
    }

    // Check lockout
    if (user.lockout_until && new Date(user.lockout_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.lockout_until).getTime() - Date.now()) / 60000);
      res.status(429).json({ error: `Account locked. Try again in ${remaining} minutes.` });
      return;
    }

    // Verify password
    const isValid = await comparePassword(password, user.password_hash);
    if (!isValid) {
      // Increment failed attempts
      const attempts = (user.failed_login_attempts || 0) + 1;
      if (attempts >= 5) {
        const lockoutUntil = new Date(Date.now() + 15 * 60000).toISOString();
        db.prepare('UPDATE users SET failed_login_attempts = ?, lockout_until = ? WHERE id = ?')
          .run(attempts, lockoutUntil, user.id);
        res.status(429).json({ error: 'Too many failed attempts. Account locked for 15 minutes.' });
        return;
      }
      db.prepare('UPDATE users SET failed_login_attempts = ? WHERE id = ?').run(attempts, user.id);
      res.status(401).json({ error: 'Invalid credentials.' });
      return;
    }

    // Reset failed attempts on successful login
    const ip = req.ip || req.socket.remoteAddress || '';
    db.prepare('UPDATE users SET failed_login_attempts = 0, lockout_until = NULL, last_login = ?, last_login_ip = ? WHERE id = ?')
      .run(new Date().toISOString(), ip, user.id);

    // Generate tokens
    const payload = {
      userId: user.id,
      role: user.role,
      email: user.email,
      credentialId: user.credential_id
    };

    const accessToken = generateAccessToken(payload);
    const refreshToken = generateRefreshToken(payload);

    // Log the login action
    logAudit(user.id, 'LOGIN', 'user', user.id, 'User logged in', ip);

    // Get tenant info if tenant role
    let tenantInfo = null;
    if (user.role === 'tenant') {
      tenantInfo = db.prepare('SELECT * FROM tenants WHERE user_id = ? AND is_deleted = 0').get(user.id);
    }

    res.json({
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        credentialId: user.credential_id,
        mustResetPassword: user.must_reset_password === 1,
        darkMode: user.dark_mode === 1,
        tenantInfo
      }
    });
  } catch (error: any) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error during login.' });
  }
});

// POST /api/auth/refresh
router.post('/refresh', (req: Request, res: Response) => {
  try {
    const { refreshToken } = req.body;
    if (!refreshToken) {
      res.status(400).json({ error: 'Refresh token required.' });
      return;
    }

    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      res.status(401).json({ error: 'Invalid refresh token.' });
      return;
    }

    const newPayload = { userId: payload.userId, role: payload.role, email: payload.email, credentialId: payload.credentialId };
    const accessToken = generateAccessToken(newPayload);
    const newRefreshToken = generateRefreshToken(newPayload);

    res.json({ accessToken, refreshToken: newRefreshToken });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/auth/reset-password
router.post('/reset-password', authMiddleware as any, async (req: AuthRequest, res: Response) => {
  try {
    const { currentPassword, newPassword } = req.body;
    const userId = req.user!.userId;

    if (!newPassword || newPassword.length < 8) {
      res.status(400).json({ error: 'New password must be at least 8 characters.' });
      return;
    }

    const user: any = db.prepare('SELECT * FROM users WHERE id = ?').get(userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }

    // If not first-time reset, verify current password
    if (!user.must_reset_password) {
      if (!currentPassword) {
        res.status(400).json({ error: 'Current password required.' });
        return;
      }
      const isValid = await comparePassword(currentPassword, user.password_hash);
      if (!isValid) {
        res.status(401).json({ error: 'Current password is incorrect.' });
        return;
      }
    }

    const newHash = await hashPassword(newPassword);
    db.prepare('UPDATE users SET password_hash = ?, must_reset_password = 0, updated_at = ? WHERE id = ?')
      .run(newHash, new Date().toISOString(), userId);

    logAudit(userId, 'PASSWORD_RESET', 'user', userId, 'Password changed');

    res.json({ message: 'Password updated successfully.' });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// POST /api/auth/toggle-dark-mode
router.post('/toggle-dark-mode', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user!.userId;
    const user: any = db.prepare('SELECT dark_mode FROM users WHERE id = ?').get(userId);
    const newMode = user.dark_mode ? 0 : 1;
    db.prepare('UPDATE users SET dark_mode = ? WHERE id = ?').run(newMode, userId);
    res.json({ darkMode: newMode === 1 });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware as any, (req: AuthRequest, res: Response) => {
  try {
    const user: any = db.prepare('SELECT id, email, role, credential_id, dark_mode, must_reset_password FROM users WHERE id = ?').get(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: 'User not found.' });
      return;
    }
    let tenantInfo = null;
    if (user.role === 'tenant') {
      tenantInfo = db.prepare('SELECT * FROM tenants WHERE user_id = ? AND is_deleted = 0').get(user.id);
    }
    res.json({ ...user, tenantInfo });
  } catch (error: any) {
    res.status(500).json({ error: 'Server error.' });
  }
});

export default router;
