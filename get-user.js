const fs = require('fs');
const path = require('path');
const admin = require('firebase-admin');

// Load .env.local manually
const envPath = path.join(__dirname, '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const match = trimmed.match(/^([^=]+)=(.*)$/);
    if (match) {
      const key = match[1].trim();
      let val = match[2].trim();
      if (val.startsWith('"') && val.endsWith('"')) {
        val = val.substring(1, val.length - 1);
      }
      process.env[key] = val;
    }
  });
}

function normalizePrivateKey(value) {
  if (!value) return undefined;
  return value
    .replace(/^['"]+|['"]+$/g, '')
    .replace(/\\n/g, '\n')
    .replace(/\r/g, '')
    .trim();
}

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = normalizePrivateKey(process.env.FIREBASE_PRIVATE_KEY);

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  })
});

const db = admin.firestore();

async function run() {
  const snapshot = await db.collection('users').where('role', '==', 'resident').get();
  for (const doc of snapshot.docs) {
    const data = doc.data();
    if (data.fullName.includes("Cj")) {
      console.log("Cj's data:", data);
    }
  }
}
run();
