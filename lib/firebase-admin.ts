import 'server-only';
import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import { getStorage } from 'firebase-admin/storage';

type ServiceAccountShape = {
  project_id?: string;
  client_email?: string;
  private_key?: string;
};

function normalizePrivateKey(value?: string) {
  if (!value) {
    return undefined;
  }

  return value
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
}

let projectId = process.env.FIREBASE_PROJECT_ID;
let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if ((!projectId || !clientEmail || !privateKey) && process.env.FIREBASE_ADMIN_SDK_KEY) {
  try {
    const parsedKey = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY) as ServiceAccountShape;
    projectId = parsedKey.project_id ?? projectId;
    clientEmail = parsedKey.client_email ?? clientEmail;
    privateKey = normalizePrivateKey(parsedKey.private_key) ?? privateKey;
  } catch (error) {
    throw new Error('FIREBASE_ADMIN_SDK_KEY is not valid JSON.');
  }
}

const adminApp =
  getApps().length > 0
    ? getApps()[0]
    : (projectId && clientEmail && privateKey) 
      ? initializeApp({
          credential: cert({
            projectId,
            clientEmail,
            privateKey,
          }),
          storageBucket: process.env.FIREBASE_STORAGE_BUCKET || process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
        })
      : null;

export const adminAuth = adminApp ? getAuth(adminApp) : null as any;
export const adminDb = adminApp ? getFirestore(adminApp) : null as any;
export const adminStorage = adminApp ? getStorage(adminApp) : null as any;
