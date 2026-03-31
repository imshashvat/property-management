import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

export async function GET(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const propertyId = searchParams.get('propertyId');
  const status = searchParams.get('status');

  const where: Record<string, unknown> = { isActive: true };
  if (propertyId) where.propertyId = propertyId;
  if (status) where.status = status;

  const flats = await prisma.flat.findMany({
    where,
    include: {
      property: { select: { id: true, name: true } },
      assignments: {
        where: { isActive: true },
        include: { tenant: { select: { id: true, firstName: true, lastName: true, credentialId: true } } },
      },
    },
    orderBy: { flatNumber: 'asc' },
  });

  return success(flats);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { propertyId, flatNumber, floor, bedrooms, bathrooms, area, rentAmount, depositAmount, furnishing, description } = body;

    if (!propertyId || !flatNumber || !rentAmount) {
      return error('Property, flat number, and rent amount are required');
    }

    const flat = await prisma.flat.create({
      data: {
        propertyId, flatNumber,
        floor: floor || 0,
        bedrooms: bedrooms || 1,
        bathrooms: bathrooms || 1,
        area: area || null,
        rentAmount: parseFloat(rentAmount),
        depositAmount: depositAmount ? parseFloat(depositAmount) : null,
        furnishing: furnishing || 'UNFURNISHED',
        description: description || null,
      },
    });

    // Update property total flats count
    await prisma.property.update({
      where: { id: propertyId },
      data: { totalFlats: { increment: 1 } },
    });

    return success(flat, 201);
  } catch (e: unknown) {
    const err = e as { code?: string };
    if (err.code === 'P2002') {
      return error('A flat with this number already exists in this property');
    }
    console.error('Create flat error:', e);
    return error('Failed to create flat', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return error('Flat ID is required');

    if (data.rentAmount) data.rentAmount = parseFloat(data.rentAmount);
    if (data.depositAmount) data.depositAmount = parseFloat(data.depositAmount);
    if (data.area) data.area = parseFloat(data.area);
    if (data.floor) data.floor = parseInt(data.floor);
    if (data.bedrooms) data.bedrooms = parseInt(data.bedrooms);
    if (data.bathrooms) data.bathrooms = parseInt(data.bathrooms);

    const flat = await prisma.flat.update({ where: { id }, data });
    return success(flat);
  } catch {
    return error('Failed to update flat', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  if (!id) return error('Flat ID is required');

  const flat = await prisma.flat.findUnique({ where: { id } });
  if (!flat) return error('Flat not found', 404);

  await prisma.flat.update({ where: { id }, data: { isActive: false } });
  await prisma.property.update({
    where: { id: flat.propertyId },
    data: { totalFlats: { decrement: 1 } },
  });

  return success({ message: 'Flat deleted' });
}
