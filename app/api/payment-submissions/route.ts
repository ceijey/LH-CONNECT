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
  status: 'Verified' | 'Pending';
  submittedDate: string;
  verifiedDate?: string;
  submittedAt?: any;
  verifiedAt?: any;
};

function toSubmission(doc: any): PaymentSubmission {
  const data = doc.data();
  const submittedAt = data.submittedAt;
  const submittedDate = data.submittedDate || (submittedAt?.toDate ? submittedAt.toDate().toLocaleString() : new Date().toLocaleString());

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
    status: data.status === 'Verified' ? 'Verified' : 'Pending',
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

    const submissionsSnapshot = await adminDb
      .collection('payment_submissions')
      .where('residentId', '==', userId)
      .get();

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
    const paymentAmount = Number(formData.get('paymentAmount') ?? 0);
    const paymentMethod = String(formData.get('paymentMethod') ?? '').trim();
    const referenceNumber = String(formData.get('referenceNumber') ?? '').trim();
    const notes = String(formData.get('notes') ?? '').trim();
    const file = formData.get('file');

    if (!residentName || !blockLot || !paymentMethod || !referenceNumber) {
      return createErrorResponse('Missing required fields', 400);
    }

    if (!(file instanceof File)) {
      return createErrorResponse('Payment proof file is required', 400);
    }

    const safeFileName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const filePath = `payment-submissions/${userId}/${Date.now()}-${safeFileName}`;
    const buffer = Buffer.from(await file.arrayBuffer());
    const bucket = adminStorage.bucket();
    const storageFile = bucket.file(filePath);

    await storageFile.save(buffer, {
      metadata: {
        contentType: file.type || 'application/octet-stream',
      },
      resumable: false,
    });

    const [fileUrl] = await storageFile.getSignedUrl({
      action: 'read',
      expires: '01-01-2500',
    });

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
      status: 'Pending' as const,
      month: currentMonth,
      submittedDate: submittedAt.toLocaleString(),
      verifiedDate: undefined,
    };

    return NextResponse.json({ submission });
  } catch (error: any) {
    console.error('Error creating payment submission:', error.message || error);
    return createErrorResponse('Failed to submit payment proof', 500);
  }
}
