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
    const fileUrl = submission.fileUrl as string | undefined;

    // Serve file from Firebase Storage if filePath exists
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

    return createErrorResponse('No proof file available', 404);
  } catch (error: any) {
    console.error('Error serving proof file:', error?.message ?? error);
    return createErrorResponse('Internal server error', 500);
  }
}