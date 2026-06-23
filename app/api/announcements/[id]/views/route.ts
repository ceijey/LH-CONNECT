import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error || !tokenVerification.decoded) {
    return createErrorResponse(tokenVerification.error ?? 'Unauthorized', tokenVerification.status ?? 401);
  }

  try {
    const viewsSnapshot = await adminDb
      .collection('announcements')
      .doc(id)
      .collection('views')
      .orderBy('viewedAt', 'desc')
      .get();

    const viewers = viewsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const viewedAt = data.viewedAt?.toDate ? data.viewedAt.toDate() : new Date(data.viewedAt || Date.now());
      return {
        userId: doc.id,
        userName: data.userName,
        viewedAt: viewedAt.toISOString(),
      };
    });

    return NextResponse.json({ viewers, count: viewers.length });
  } catch (error: any) {
    console.error('Error fetching announcement views:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
