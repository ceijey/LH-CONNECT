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

const auth = admin.auth();
const db = admin.firestore();

async function updateAdmin() {
  const email = 'lhconnectadmin@gmail.com';
  console.log(`Updating password for admin user ${email} to "lhconnect2026"...`);
  try {
    const user = await auth.getUserByEmail(email);
    await auth.updateUser(user.uid, {
      password: 'lhconnect2026'
    });
    console.log("✅ Success! Admin password updated to lhconnect2026.");
  } catch (err) {
    console.error("❌ Failed to update admin password:", err);
  }
}

updateAdmin();
