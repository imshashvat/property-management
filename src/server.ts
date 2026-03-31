import express from 'express';
import cors from 'cors';
import path from 'path';
import dotenv from 'dotenv';
import { initializeDatabase } from './db/database';

// Import routes
import authRoutes from './routes/auth.routes';
import propertyRoutes from './routes/property.routes';
import flatRoutes from './routes/flat.routes';
import tenantRoutes from './routes/tenant.routes';
import assignmentRoutes from './routes/assignment.routes';
import rentRoutes from './routes/rent.routes';
import maintenanceRoutes from './routes/maintenance.routes';
import dashboardRoutes from './routes/dashboard.routes';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000');

// Middleware
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Serve static files from public directory
app.use(express.static(path.join(__dirname, '..', 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/flats', flatRoutes);
app.use('/api/tenants', tenantRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/rent', rentRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/dashboard', dashboardRoutes);

// SPA fallback - serve index.html for non-API routes
app.get('/admin', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

app.get('/tenant', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'tenant.html'));
});

app.get('/reset-password', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// Initialize database and start server
initializeDatabase();

app.listen(PORT, () => {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║   Property Management System (PMS)       ║
  ║   Server running on port ${PORT}            ║
  ║   http://localhost:${PORT}                  ║
  ╚══════════════════════════════════════════╝
  `);
});

export default app;
