import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

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
    ] = await Promise.all([
      prisma.property.count({ where: { isActive: true } }),
      prisma.flat.count({ where: { isActive: true } }),
      prisma.flat.count({ where: { isActive: true, status: 'OCCUPIED' } }),
      prisma.flat.count({ where: { isActive: true, status: 'VACANT' } }),
      prisma.flat.count({ where: { isActive: true, status: 'UNDER_MAINTENANCE' } }),
      prisma.tenant.count(),
      prisma.tenant.count({ where: { isActive: true } }),
      prisma.payment.count(),
      prisma.payment.count({ where: { status: 'PAID' } }),
      prisma.payment.count({ where: { status: 'PENDING' } }),
      prisma.payment.count({ where: { status: 'OVERDUE' } }),
      prisma.maintenanceRequest.count({ where: { status: 'OPEN' } }),
      prisma.maintenanceRequest.count({ where: { status: 'IN_PROGRESS' } }),
      prisma.maintenanceRequest.count({ where: { status: { in: ['RESOLVED', 'CLOSED'] } } }),
      prisma.payment.findMany({
        where: { status: 'PAID' },
        take: 5,
        orderBy: { paidDate: 'desc' },
        include: {
          tenant: { select: { firstName: true, lastName: true } },
          flat: { select: { flatNumber: true } },
        },
      }),
      prisma.maintenanceRequest.findMany({
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          tenant: { select: { firstName: true, lastName: true } },
          flat: { select: { flatNumber: true } },
        },
      }),
    ]);

    // Calculate revenue
    const paidPaymentsData = await prisma.payment.aggregate({
      where: { status: 'PAID' },
      _sum: { amount: true },
    });

    const pendingPaymentsData = await prisma.payment.aggregate({
      where: { status: { in: ['PENDING', 'OVERDUE'] } },
      _sum: { amount: true },
    });

    const occupancyRate = totalFlats > 0 ? Math.round((occupiedFlats / totalFlats) * 100) : 0;
    const collectionRate = totalPayments > 0 ? Math.round((paidPayments / totalPayments) * 100) : 0;

    return success({
      properties: { total: totalProperties },
      flats: { total: totalFlats, occupied: occupiedFlats, vacant: vacantFlats, maintenance: maintenanceFlats },
      tenants: { total: totalTenants, active: activeTenants },
      payments: {
        total: totalPayments,
        paid: paidPayments,
        pending: pendingPayments,
        overdue: overduePayments,
        revenue: paidPaymentsData._sum.amount || 0,
        outstanding: pendingPaymentsData._sum.amount || 0,
      },
      maintenance: {
        open: openMaintenance,
        inProgress: inProgressMaintenance,
        resolved: resolvedMaintenance,
      },
      rates: { occupancy: occupancyRate, collection: collectionRate },
      recent: { payments: recentPayments, maintenance: recentMaintenance },
    });
  } catch (e) {
    console.error('Dashboard error:', e);
    return error('Failed to load dashboard data', 500);
  }
}
