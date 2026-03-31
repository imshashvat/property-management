import { NextRequest } from 'next/server';
import { prisma } from '@/lib/prisma';
import { success, error, requireAuth } from '@/lib/utils';

export async function GET() {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const properties = await prisma.property.findMany({
    where: { isActive: true },
    include: { _count: { select: { flats: true } } },
    orderBy: { createdAt: 'desc' },
  });

  return success(properties);
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { name, address, city, state, zipCode, type, description, amenities } = body;

    if (!name || !address || !city || !state || !zipCode) {
      return error('Name, address, city, state, and zip code are required');
    }

    const property = await prisma.property.create({
      data: {
        name, address, city, state, zipCode,
        type: type || 'APARTMENT',
        description: description || null,
        amenities: amenities ? JSON.stringify(amenities) : null,
      },
    });

    return success(property, 201);
  } catch (e) {
    console.error('Create property error:', e);
    return error('Failed to create property', 500);
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  try {
    const body = await req.json();
    const { id, ...data } = body;

    if (!id) return error('Property ID is required');

    if (data.amenities && typeof data.amenities !== 'string') {
      data.amenities = JSON.stringify(data.amenities);
    }

    const property = await prisma.property.update({
      where: { id },
      data,
    });

    return success(property);
  } catch {
    return error('Failed to update property', 500);
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(['ADMIN']);
  if (auth.error) return auth.error;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');

  if (!id) return error('Property ID is required');

  await prisma.property.update({
    where: { id },
    data: { isActive: false },
  });

  return success({ message: 'Property deleted' });
}
