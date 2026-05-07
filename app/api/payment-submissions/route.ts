import { NextRequest, NextResponse } from 'next/server';
import { verifyToken, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminStorage } from '@/lib/firebase-admin';

type PaymentSubmission = {
  id: string;
  residentId: string;
  residentName: string;
  blockLot: string;
  paymentAmount: number;
  paymentMethod: string;
  referenceNumber: string;
  notes?: string;
  fileName?: string;
  fileUrl?: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  submittedDate: string;
  verifiedDate?: string;
  submittedAt?: any;
  verifiedAt?: any;
};

function toSubmission(doc: any): PaymentSubmission {
  const data = doc.data();
  const submittedAt = data.submittedAt;
  
  // Convert Firestore Timestamp to Date
  let submittedDate = data.submittedDate;
  let month = data.month;
  
  if (!submittedDate || submittedDate === 'Invalid Date') {
    const dateObj = submittedAt?.toDate?.() 
      ? submittedAt.toDate() 
      : typeof submittedAt === 'string' ? new Date(submittedAt) : new Date();
    
    if (dateObj && dateObj.getTime && !isNaN(dateObj.getTime())) {
      submittedDate = dateObj.toLocaleString();
      if (!month) {
        month = dateObj.toLocaleString(undefined, { month: 'long', year: 'numeric' });
      }
    } else {
      submittedDate = new Date().toLocaleString();
      if (!month) {
        month = new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' });
      }
    }
  }

  return {
    id: doc.id,
    residentId: data.residentId,
    residentName: data.residentName,
    blockLot: data.blockLot,
    paymentAmount: Number(data.paymentAmount ?? 0),
    paymentMethod: data.paymentMethod ?? 'Unknown',
    referenceNumber: data.referenceNumber ?? '',
    notes: data.notes,
    fileName: data.fileName,
    fileUrl: data.fileUrl,
    status: data.status || 'Pending',
    submittedDate,
    verifiedDate: data.verifiedDate,
    submittedAt,
    verifiedAt: data.verifiedAt,
  };
}

export async function GET(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

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

    // If the user is an admin, return all submissions; otherwise return only the resident's submissions
    const isAdmin = (userData.role ?? '') === 'admin';
    const submissionsQuery = isAdmin
      ? adminDb.collection('payment_submissions')
      : adminDb.collection('payment_submissions').where('residentId', '==', userId);

    const submissionsSnapshot = await submissionsQuery.get();

    const submissions = submissionsSnapshot.docs
      .map((doc: any) => toSubmission(doc))
      .sort((a: PaymentSubmission, b: PaymentSubmission) => {
        const toMillis = (value: any) => {
          if (!value) return 0;
          if (typeof value.toMillis === 'function') return value.toMillis();
          if (typeof value.toDate === 'function') return value.toDate().getTime();
          const numeric = Number(value);
          return Number.isFinite(numeric) ? numeric : new Date(value).getTime() || 0;
        };

        return toMillis(b.submittedAt) - toMillis(a.submittedAt);
      });

    return NextResponse.json({ submissions, user: decoded });
  } catch (error: any) {
    console.error('Error fetching payment submissions:', error.message || error);
    return createErrorResponse('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  const tokenVerification = await verifyToken(request);

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

    const formData = await request.formData();
    const residentName = String(formData.get('residentName') ?? '').trim();
    const blockLot = String(formData.get('blockLot') ?? '').trim();
    const paymentAmountStr = String(formData.get('paymentAmount') ?? '').trim();
    const paymentAmount = Number(paymentAmountStr) || 0;
    const paymentMethod = String(formData.get('paymentMethod') ?? '').trim();
    const referenceNumber = String(formData.get('referenceNumber') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const file = formData.get('file');

    // Detailed validation
    if (!residentName) {
      return createErrorResponse('Resident name is required', 400);
    }

    if (!blockLot) {
      return createErrorResponse('Block/Lot information is required', 400);
    }

    if (!paymentAmountStr) {
      return createErrorResponse('Payment amount is required', 400);
    }

    if (paymentAmount <= 0) {
      return createErrorResponse('Payment amount must be greater than 0', 400);
    }

    if (!paymentMethod) {
      return createErrorResponse('Payment method is required', 400);
    }

    if (!referenceNumber) {
      return createErrorResponse('Reference number is required', 400);
    }

    if (!(file instanceof File)) {
      return createErrorResponse('Payment proof file is required', 400);
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `payment-submissions/${userId}/${Date.now()}-${safeFileName}`;
      const buffer = Buffer.from(await file.arrayBuffer());
      let fileUrl: string | null = null;
      let usedFilePath: string | null = null;
      let fileUploadError: any = null;

      try {
        // Use configured bucket if present, otherwise default
        const envBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const bucket = envBucket ? adminStorage.bucket(envBucket) : adminStorage.bucket();

        // Check bucket existence to provide clearer errors
        try {
          const [exists] = await bucket.exists();
          if (!exists) {
            throw new Error(`Bucket does not exist: ${envBucket || '<default>'}`);
          }
        } catch (chkErr) {
          // If bucket existence check fails, surface concise error
          throw chkErr;
        }

        const storageFile = bucket.file(filePath);
        await storageFile.save(buffer, {
          metadata: {
            contentType: file.type || 'application/octet-stream',
          },
          resumable: false,
        });

        const [signedUrl] = await storageFile.getSignedUrl({
          action: 'read',
          expires: '01-01-2500',
        });

        fileUrl = signedUrl;
        usedFilePath = filePath;
      } catch (uploadError: any) {
        console.error('File upload failed:', {
          message: uploadError?.message ?? uploadError,
          code: uploadError?.code,
        });
        fileUploadError = {
          message: uploadError?.message ?? String(uploadError),
          code: uploadError?.code ?? null,
        };
        // Continue: we will still create a submission record so admins can follow up
      }

    const submittedAt = new Date();
    const currentMonth = submittedAt.toLocaleString(undefined, { month: 'long', year: 'numeric' });

    const docRef = await adminDb.collection('payment_submissions').add({
      residentId: userId,
      residentName,
      blockLot,
      paymentAmount,
      paymentMethod,
      referenceNumber,
      notes,
      fileName: file.name,
      fileUrl,
      filePath,
      status: 'Pending',
      month: currentMonth,
      submittedDate: submittedAt.toLocaleString(),
      submittedAt,
      verifiedDate: null,
      verifiedAt: null,
      createdAt: submittedAt,
      updatedAt: submittedAt,
    });

    const submission = {
      id: docRef.id,
      residentId: userId,
      residentName,
      blockLot,
      paymentAmount,
      paymentMethod,
      referenceNumber,
      notes,
      fileName: file.name,
      fileUrl,
      filePath: usedFilePath,
      fileUploadError: fileUploadError ?? null,
      status: 'Pending' as const,
      month: currentMonth,
      submittedDate: submittedAt.toLocaleString(),
      verifiedDate: undefined,
    };

    // Create an admin notification so admins immediately see new submissions (including failed uploads)
    try {
      await adminDb.collection('admin_notifications').add({
        type: 'payment_submission',
        submissionId: docRef.id,
        residentId: userId,
        residentName,
        blockLot,
        paymentAmount,
        paymentMethod,
        referenceNumber,
        fileName: file.name,
        fileUrl: fileUrl ?? null,
        fileUploadError: fileUploadError ?? null,
        status: 'pending',
        createdAt: new Date(),
        read: false,
      });
    } catch (notifyErr) {
      // Avoid assuming structure of the caught value; log it directly for diagnostics
      console.error('Failed to create admin notification:', notifyErr);
    }

    return NextResponse.json({ submission });
  } catch (error: any) {
    console.error('Error creating payment submission:', {
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      fullError: error,
    });
    return createErrorResponse(`Failed to submit payment proof: ${error?.message || 'Unknown error'}`, 500);
  }
}
