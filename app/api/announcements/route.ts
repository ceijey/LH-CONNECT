import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  try {
    const announcementsSnapshot = await adminDb
      .collection('announcements')
      .orderBy('createdAt', 'desc')
      .get();

    const announcements = announcementsSnapshot.docs.map((doc: any) => {
      const data = doc.data();
      const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || Date.now());
      return {
        id: doc.id,
        ...data,
        createdAt: createdAt.toISOString(),
      };
    });

    return NextResponse.json({ announcements });
  } catch (error: any) {
    console.error('Error fetching announcements:', error.message);
    return createErrorResponse('Internal server error', 500);
  }
}
