import { db } from '@/lib/db';
import { success, error, requireAuth } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const [
      totalProperties,
      totalFlats,
      occupiedFlats,
      vacantFlats,
      maintenanceFlats,
      totalTenants,
      activeTenants,
      totalPayments,
      paidPayments,
      pendingPayments,
      overduePayments,
      openMaintenance,
      inProgressMaintenance,
      resolvedMaintenance,
      recentPayments,
      recentMaintenance,
      paidPaymentsData,
      pendingPaymentsData
    ] = await Promise.all([
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Property" WHERE "isActive" = true'),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Flat" WHERE "isActive" = true'),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Flat" WHERE "isActive" = true AND status = $1', ['OCCUPIED']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Flat" WHERE "isActive" = true AND status = $1', ['VACANT']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Flat" WHERE "isActive" = true AND status = $1', ['UNDER_MAINTENANCE']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Tenant"'),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Tenant" WHERE "isActive" = true'),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Payment"'),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Payment" WHERE status = $1', ['PAID']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Payment" WHERE status = $1', ['PENDING']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "Payment" WHERE status = $1', ['OVERDUE']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "MaintenanceRequest" WHERE status = $1', ['OPEN']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "MaintenanceRequest" WHERE status = $1', ['IN_PROGRESS']),
      db.fetchOne('SELECT COUNT(*)::int as count FROM "MaintenanceRequest" WHERE status IN ($1, $2)', ['RESOLVED', 'CLOSED']),
      db.fetchAll(`
        SELECT p.*, t."firstName", t."lastName", f."flatNumber"
        FROM "Payment" p
        JOIN "Tenant" t ON p."tenantId" = t.id
        JOIN "Flat" f ON p."flatId" = f.id
        WHERE p.status = 'PAID'
        ORDER BY p."paidDate" DESC
        LIMIT 5
      `),
      db.fetchAll(`
        SELECT m.*, t."firstName", t."lastName", f."flatNumber"
        FROM "MaintenanceRequest" m
        JOIN "Tenant" t ON m."tenantId" = t.id
        JOIN "Flat" f ON m."flatId" = f.id
        ORDER BY m."createdAt" DESC
        LIMIT 5
      `),
      db.fetchOne('SELECT COALESCE(SUM(amount), 0)::float as sum FROM "Payment" WHERE status = $1', ['PAID']),
      db.fetchOne('SELECT COALESCE(SUM(amount), 0)::float as sum FROM "Payment" WHERE status IN ($1, $2)', ['PENDING', 'OVERDUE'])
    ]);

    const tFlats = totalFlats?.count || 0;
    const oFlats = occupiedFlats?.count || 0;
    const tPayments = totalPayments?.count || 0;
    const pPayments = paidPayments?.count || 0;

    const occupancyRate = tFlats > 0 ? Math.round((oFlats / tFlats) * 100) : 0;
    const collectionRate = tPayments > 0 ? Math.round((pPayments / tPayments) * 100) : 0;

    return success({
      properties: { total: totalProperties?.count || 0 },
      flats: { 
        total: tFlats, 
        occupied: oFlats, 
        vacant: vacantFlats?.count || 0, 
        maintenance: maintenanceFlats?.count || 0 
      },
      tenants: { total: totalTenants?.count || 0, active: activeTenants?.count || 0 },
      payments: {
        total: tPayments,
        paid: pPayments,
        pending: pendingPayments?.count || 0,
        overdue: overduePayments?.count || 0,
        revenue: paidPaymentsData?.sum || 0,
        outstanding: pendingPaymentsData?.sum || 0,
      },
      maintenance: {
        open: openMaintenance?.count || 0,
        inProgress: inProgressMaintenance?.count || 0,
        resolved: resolvedMaintenance?.count || 0,
      },
      rates: { occupancy: occupancyRate, collection: collectionRate },
      recent: { 
        payments: (recentPayments || []).map(p => ({
          ...p,
          tenant: { firstName: p.firstName, lastName: p.lastName },
          flat: { flatNumber: p.flatNumber }
        })), 
        maintenance: (recentMaintenance || []).map(m => ({
          ...m,
          tenant: { firstName: m.firstName, lastName: m.lastName },
          flat: { flatNumber: m.flatNumber }
        })) 
      },
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    return error('Failed to load dashboard data', 500);
  }
}
