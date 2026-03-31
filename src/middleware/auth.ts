import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import db from '../db/database';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'pms-secret';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'pms-refresh-secret';
const BCRYPT_ROUNDS = parseInt(process.env.BCRYPT_ROUNDS || '12');

export interface JwtPayload {
  userId: number;
  role: string;
  email?: string;
  credentialId?: string;
}

export interface AuthRequest extends Request {
  user?: JwtPayload;
}

// Hash password with bcrypt
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

// Compare password with hash
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

// Generate access token (15 min)
export function generateAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
}

// Generate refresh token (7 days)
export function generateRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_REFRESH_SECRET, { expiresIn: '7d' });
}

// Verify access token
export function verifyAccessToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// Verify refresh token
export function verifyRefreshToken(token: string): JwtPayload | null {
  try {
    return jwt.verify(token, JWT_REFRESH_SECRET) as JwtPayload;
  } catch {
    return null;
  }
}

// Generate unique credential ID: TNT-[PROPERTYCODE]-[YEAR]-[SEQUENCE]
export function generateCredentialId(propertyCode: string): string {
  const year = new Date().getFullYear();
  const prefix = `TNT-${propertyCode.toUpperCase()}-${year}`;

  // Find the highest existing sequence for this prefix
  const row = db.prepare(
    `SELECT credential_id FROM users WHERE credential_id LIKE ? ORDER BY credential_id DESC LIMIT 1`
  ).get(`${prefix}-%`) as { credential_id: string } | undefined;

  let seq = 1;
  if (row) {
    const parts = row.credential_id.split('-');
    seq = parseInt(parts[parts.length - 1]) + 1;
  }

  return `${prefix}-${String(seq).padStart(3, '0')}`;
}

// Generate temporary password
export function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}

// Auth middleware - validates JWT token
export function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): void {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. No token provided.' });
    return;
  }

  const token = authHeader.split(' ')[1];
  const payload = verifyAccessToken(token);

  if (!payload) {
    res.status(401).json({ error: 'Invalid or expired token.' });
    return;
  }

  // Check if user is still active
  const user = db.prepare('SELECT is_active FROM users WHERE id = ?').get(payload.userId) as { is_active: number } | undefined;
  if (!user || !user.is_active) {
    res.status(401).json({ error: 'Account is deactivated.' });
    return;
  }

  req.user = payload;
  next();
}

// Admin-only middleware
export function adminOnly(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Admin only.' });
    return;
  }
  next();
}

// Audit logging helper
export function logAudit(userId: number | null, actionType: string, entityType: string, entityId: number | null, details: string = '', ip: string = ''): void {
  db.prepare(
    `INSERT INTO audit_logs (user_id, action_type, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)`
  ).run(userId, actionType, entityType, entityId, details, ip);
}
