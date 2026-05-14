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
      console.log(`[ProofProxy] Checking for file in bucket: ${bucket.name}`);
      const storageFile = bucket.file(filePath);
      
      try {
        const [exists] = await storageFile.exists();

        if (exists) {
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
        } else {
          console.error(`[ProofProxy] File does not exist in storage: ${filePath} (Bucket: ${bucket.name})`);
        }
      } catch (err: any) {
        console.error(`[ProofProxy] Storage check failed: ${err.message}`);
      }
    } else {
      console.error(`[ProofProxy] No filePath found for submission: ${id}`);
    }

    // Fallback: If filePath doesn't work but fileUrl exists, handle it
    if (fileUrl) {
      // If it's a Base64 string, decode and serve it as binary
      if (fileUrl.startsWith('data:')) {
        try {
          const [mimePart, base64Data] = fileUrl.split(';base64,');
          const contentType = mimePart.split(':')[1] || 'image/jpeg';
          const buffer = Buffer.from(base64Data, 'base64');

          return new NextResponse(buffer, {
            status: 200,
            headers: {
              'Content-Type': contentType,
              'Content-Disposition': `inline; filename="${fileName || 'proof'}"`,
              'Cache-Control': 'private, max-age=3600',
            },
          });
        } catch (e) {
          console.error(`[ProofProxy] Failed to decode Base64 for submission ${id}`);
        }
      }
      
      // If it's a standard URL, redirect to it
      return NextResponse.redirect(fileUrl);
    }

    console.error(`[ProofProxy] No proof available for submission ${id}. Fields present: ${Object.keys(submission).join(', ')}`);
    return createErrorResponse('No proof file available', 404);
  } catch (error: any) {
    console.error('Error serving proof file:', error?.message ?? error);
    return createErrorResponse('Internal server error', 500);
  }
}