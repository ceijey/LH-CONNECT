import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

function inferContentType(fileName?: string) {
  const lowerName = (fileName ?? '').toLowerCase();
  if (lowerName.endsWith('.png')) return 'image/png';
  if (lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg')) return 'image/jpeg';
  if (lowerName.endsWith('.webp')) return 'image/webp';
  if (lowerName.endsWith('.gif')) return 'image/gif';
  if (lowerName.endsWith('.pdf')) return 'application/pdf';
  return 'application/octet-stream';
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const decoded = tokenVerification.decoded!;
  const userId = decoded.uid;

  try {
    const userDoc = await adminDb.collection('users').doc(userId).get();
    const userData = userDoc.data();

    if (!userData) {
      return createErrorResponse('User not found', 404);
    }

    const submissionDoc = await adminDb.collection('payment_submissions').doc(id).get();
    if (!submissionDoc.exists) {
      return createErrorResponse('Submission not found', 404);
    }

    const submission = submissionDoc.data()!;
    const isAdmin = (userData.role ?? '') === 'admin';
    const isOwner = submission.residentId === userId;

    if (!isAdmin && !isOwner) {
      return createErrorResponse('Forbidden', 403);
    }

    const filePath = submission.filePath as string | undefined;
    const fileName = submission.fileName as string | undefined;

    if (filePath) {
      const envBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
      const bucket = envBucket ? adminStorage.bucket(envBucket) : adminStorage.bucket();
      const storageFile = bucket.file(filePath);
      const [exists] = await storageFile.exists();

      if (!exists) {
        return createErrorResponse('Proof file not found', 404);
      }

      const [metadata] = await storageFile.getMetadata();
      const [buffer] = await storageFile.download();
      const contentType = metadata?.contentType || inferContentType(fileName);

      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `inline; filename="${fileName || 'proof'}"`,
          'Cache-Control': 'private, max-age=300',
        },
      });
    }

    const legacyFileUrl = submission.fileUrl as string | undefined;

    if (!legacyFileUrl) {
      return createErrorResponse('No proof file available', 404);
    }

    const legacyResponse = await fetch(legacyFileUrl);
    if (!legacyResponse.ok) {
      return createErrorResponse('Unable to fetch legacy proof file', 502);
    }

    const body = await legacyResponse.arrayBuffer();
    const contentType = legacyResponse.headers.get('content-type') || inferContentType(fileName);

    return new NextResponse(body, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Disposition': `inline; filename="${fileName || 'proof'}"`,
        'Cache-Control': 'private, max-age=300',
      },
    });
  } catch (error: any) {
    console.error('Error serving proof file:', error?.message ?? error);
    return createErrorResponse('Internal server error', 500);
  }
}