const fs = require('fs');
const path = require('path');

// Load .env.local
const envPath = path.join(__dirname, '../.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const firstEq = trimmed.indexOf('=');
    if (firstEq === -1) return;
    const key = trimmed.substring(0, firstEq).trim();
    let val = trimmed.substring(firstEq + 1).trim();
    if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
    if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
    process.env[key] = val;
  });
}

function normalizePrivateKey(value) {
  if (!value) return undefined;
  return value.replace(/^['"]+|['"]+$/g, '').replace(/\\n/g, '\n').replace(/\r/g, '').trim();
}

const admin = require('firebase-admin');
let projectId = process.env.FIREBASE_PROJECT_ID;
let clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
let privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

if ((!projectId || !clientEmail || !privateKey) && process.env.FIREBASE_ADMIN_SDK_KEY) {
  const parsedKey = JSON.parse(process.env.FIREBASE_ADMIN_SDK_KEY);
  projectId = parsedKey.project_id ?? projectId;
  clientEmail = parsedKey.client_email ?? clientEmail;
  privateKey = normalizePrivateKey(parsedKey.private_key) ?? privateKey;
}

if (!admin.apps.length) {
  admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
}

const db = admin.firestore();

async function listUsers() {
  console.log("Listing users from Firestore...");
  try {
    const snap = await db.collection('users').get();
    console.log(`Found ${snap.size} user(s):`);
    snap.docs.forEach(doc => {
      const data = doc.data();
      console.log(`- ${data.fullName} (${data.email}) - Role: ${data.role}, Status: ${data.status || 'N/A'}`);
    });
  } catch (err) {
    console.error("❌ FAILED:", err);
  }
}

listUsers();
