import { NextRequest, NextResponse } from 'next/server';
import { extractTokenPayload } from '@/lib/verifyFamilyAccess';
import { getPrisma } from '@/lib/prisma';

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const payload = extractTokenPayload(req);
    const { id } = await params;

    const record = await getPrisma().pdfConversion.findUnique({ where: { id } });
    if (!record) return NextResponse.json({ error: 'Conversion not found.' }, { status: 404 });
    if (record.userId !== payload.uid) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    await getPrisma().pdfConversion.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed to delete conversion.' }, { status: 500 });
  }
}
