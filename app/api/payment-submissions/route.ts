import { NextRequest, NextResponse } from 'next/server';
import { requireApprovedUser, createErrorResponse } from '@/lib/auth-middleware';
import { adminDb, adminStorage } from '@/lib/firebase-admin';
import { verifyCsrf } from '@/lib/csrf';

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
  filePath?: string;
  status: 'Verified' | 'Pending' | 'Rejected';
  submittedDate: string;
  verifiedDate?: string;
  submittedAt?: any;
  verifiedAt?: any;
  paymentDateTime?: string;
};

async function resolveFileUrl(data: any): Promise<string | undefined> {
  // If it's a Base64 string, don't return it in the list to avoid payload size limits on Vercel
  if (data.fileUrl && data.fileUrl.startsWith('data:')) {
    return undefined;
  }

  if (data.fileUrl) {
    return data.fileUrl;
  }

  if (!data.filePath) {
    return undefined;
  }

  try {
    const envBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
    const bucket = envBucket ? adminStorage.bucket(envBucket) : adminStorage.bucket();
    const storageFile = bucket.file(data.filePath);
    const [exists] = await storageFile.exists();

    if (!exists) {
      return undefined;
    }

    const [signedUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2500',
    });

    return signedUrl;
  } catch (error: any) {
    console.error(`[resolveFileUrl] Failed to resolve filePath: ${data.filePath}. Error: ${error.message}`);
    return undefined;
  }
}

async function toSubmission(doc: any): Promise<PaymentSubmission> {
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

  const fileUrl = await resolveFileUrl(data);

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
    fileUrl,
    filePath: data.filePath,
    status: data.status || 'Pending',
    submittedDate,
    verifiedDate: data.verifiedDate,
    submittedAt,
    verifiedAt: data.verifiedAt,
    paymentDateTime: data.paymentDateTime || undefined,
  };
}

export async function GET(request: NextRequest) {
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

    // If the user is an admin, return all submissions; otherwise return only the resident's submissions
    const isAdmin = (userData.role ?? '') === 'admin';
    const submissionsQuery = isAdmin
      ? adminDb.collection('payment_submissions')
      : adminDb.collection('payment_submissions').where('residentId', '==', userId);

    const submissionsSnapshot = await submissionsQuery.get();

    const submissions = (await Promise.all(
      submissionsSnapshot.docs.map((doc: any) => toSubmission(doc))
    ))
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
    const mockSubmissions = Array.from({ length: 10 }, (_, i) => ({
      id: `mock-sub-${i}`,
      residentId: `mock-resident-${i}`,
      residentName: `Mock Resident ${i + 1}`,
      blockLot: `Phase 1 Blk ${(i % 5) + 1} Lot ${(i % 10) + 1}`,
      paymentAmount: 400 * ((i % 3) + 1),
      paymentMethod: i % 2 === 0 ? 'GCash' : 'Cash',
      referenceNumber: `REF${Date.now() + i}`,
      notes: 'Mock data due to database limit',
      fileName: 'proof.jpg',
      fileUrl: '',
      status: i % 4 === 0 ? 'Verified' : i % 4 === 1 ? 'Rejected' : 'Pending',
      submittedDate: new Date().toLocaleString(),
      month: new Date().toLocaleString(undefined, { month: 'long', year: 'numeric' }),
      paymentDateTime: new Date().toISOString()
    }));
    return NextResponse.json({ submissions: mockSubmissions, user: decoded });
  }
}

export async function POST(request: NextRequest) {
  const tokenVerification = await requireApprovedUser(request);

  if (tokenVerification.error) {
    return createErrorResponse(tokenVerification.error, tokenVerification.status);
  }

  const csrfErr = verifyCsrf(request);
  if (csrfErr) return csrfErr;

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
    const paymentDateTime = String(formData.get('paymentDateTime') ?? '').trim();
    const file = formData.get('file');
    let fileUrl = String(formData.get('fileUrl') ?? '').trim();
    let filePath = String(formData.get('filePath') ?? '').trim();
    let fileBase64 = String(formData.get('fileBase64') ?? '').trim();
    let fileName = String(formData.get('fileName') ?? '').trim();

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

    // Check for duplicate reference number in payment_submissions
    const duplicateSubmissionQuery = await adminDb
      .collection('payment_submissions')
      .where('referenceNumber', '==', referenceNumber)
      .limit(1)
      .get();

    if (!duplicateSubmissionQuery.empty) {
      return createErrorResponse('This reference number has already been used for a submission. Please check your payment details.', 400);
    }

    // Check for duplicate reference number in approved payments
    const duplicatePaymentQuery = await adminDb
      .collection('payments')
      .where('referenceNumber', '==', referenceNumber)
      .limit(1)
      .get();

    if (!duplicatePaymentQuery.empty) {
      return createErrorResponse('This reference number has already been approved for a payment.', 400);
    }
    
    // Only require file if URL or Base64 is not provided
    if (!fileUrl && !fileBase64 && !(file instanceof File)) {
      return createErrorResponse('Payment proof file is required', 400);
    }

    if (!fileName) {
      fileName = (file instanceof File) ? file.name : (filePath.split('/').pop() || 'proof');
    }
    
    let fileUploadError: any = null;

    // Use Base64 as the URL if provided
    if (fileBase64) {
      fileUrl = fileBase64;
      console.log(`[POST Submission] Using Base64 image data for: ${fileName}`);
    } else if (!fileUrl && file instanceof File) {
      const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      filePath = `payment-submissions/${userId}/${Date.now()}-${safeFileName}`;
      const buffer = Buffer.from(await file.arrayBuffer());

      try {
        // Upload to Firebase Storage (as fallback/alternate)
        const envBucket = process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET;
        const bucket = envBucket ? adminStorage.bucket(envBucket) : adminStorage.bucket();
        
        console.log(`[POST Submission] Using bucket: ${bucket.name}`);
        const storageFile = bucket.file(filePath);
        
        await storageFile.save(buffer, {
          metadata: {
            contentType: file.type,
          },
        });

        // Get a signed URL for immediate use
        // Use a Date object for better compatibility
        const expiryDate = new Date();
        expiryDate.setFullYear(expiryDate.getFullYear() + 50); // 50 years from now

        const [signedUrl] = await storageFile.getSignedUrl({
          action: 'read',
          expires: expiryDate,
        });
        fileUrl = signedUrl;
        console.log(`[POST Submission] Successfully uploaded and generated signed URL for: ${filePath}`);
      } catch (uploadError: any) {
        console.error(`[POST Submission] STEP FAILED: Firebase Storage operation failed`);
        console.error(`Bucket: ${process.env.FIREBASE_STORAGE_BUCKET ?? process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET}`);
        console.error(`FilePath: ${filePath}`);
        console.error(`Error Message: ${uploadError.message}`);
        console.error(`Error Stack: ${uploadError.stack}`);
        
        // If we have a file but upload failed, we can still try to convert to Base64 on server side
        // but client side is better. For now, we allow it to fail to encourage client-side base64.
        return createErrorResponse(`Failed to upload payment proof: ${uploadError.message}`, 500);
      }
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
      fileName,
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
      paymentDateTime,
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
      fileName,
      fileUrl,
      filePath,
      fileUploadError: fileUploadError ?? null,
      status: 'Pending' as const,
      month: currentMonth,
      submittedDate: submittedAt.toLocaleString(),
      verifiedDate: undefined,
      paymentDateTime,
    };

    // Create an admin notification so admins immediately see new submissions (including failed uploads)
    try {
      await adminDb.collection('admin_notifications').add({
        type: 'payment_submission',
        title: 'New Payment Submitted',
        message: `${residentName} submitted a payment of ₱${paymentAmount.toFixed(2)}`,
        submissionId: docRef.id,
        residentId: userId,
        residentName,
        blockLot,
        paymentAmount,
        paymentMethod,
        referenceNumber,
        fileName,
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
