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

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing Firebase Admin credentials in .env.local!");
  process.exit(1);
}

admin.initializeApp({
  credential: admin.credential.cert({
    projectId,
    clientEmail,
    privateKey,
  })
});

const db = admin.firestore();
const auth = admin.auth();

const realResidents = [
  { name: "Juan Dela Cruz", phase: "Phase 1", block: "1", lot: "12", phone: "09171234567" },
  { name: "Maria Santos", phase: "Phase 1", block: "2", lot: "5", phone: "09187654321" },
  { name: "Antonio Luna", phase: "Phase 1", block: "3", lot: "8", phone: "09191112222" },
  { name: "Jose Rizal", phase: "Phase 2", block: "5", lot: "1", phone: "09203334444" },
  { name: "Corazon Aquino", phase: "Phase 2", block: "6", lot: "14", phone: "09215556666" },
  { name: "Benigno Aquino", phase: "Phase 2", block: "7", lot: "3", phone: "09227778888" },
  { name: "Emilio Aguinaldo", phase: "Phase 3", block: "10", lot: "2", phone: "09239990000" },
  { name: "Andres Bonifacio", phase: "Phase 3", block: "11", lot: "6", phone: "09241234567" },
  { name: "Melchora Aquino", phase: "Phase 3", block: "12", lot: "11", phone: "09257654321" },
  { name: "Gabriela Silang", phase: "Phase 3", block: "15", lot: "4", phone: "09261112222" },
];

async function seed() {
  try {
    console.log("Starting database seeding with 10 real residents...");

    // 1. Fetch current residents in Firestore to clean up
    const residentsSnapshot = await db
      .collection('users')
      .where('role', '==', 'resident')
      .get();

    console.log(`Found ${residentsSnapshot.size} existing residents in Firestore. Cleaning up...`);

    // Delete Firestore records
    const deletePromises = residentsSnapshot.docs.map(async doc => {
      const email = doc.data().email;
      const uid = doc.id;
      
      console.log(`Deleting Firestore record for: ${email} (${uid})`);
      await db.collection('users').doc(uid).delete();

      // Clean up Auth user if exists
      try {
        await auth.deleteUser(uid);
        console.log(`Deleted Auth user: ${email}`);
      } catch (authErr) {
        // Auth user might not exist or might already be deleted
      }
    });
    await Promise.all(deletePromises);

    // 2. Clear old statements and payment submissions to avoid stale links
    const statementsSnapshot = await db.collection('statements').get();
    const deleteStatements = statementsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deleteStatements);
    console.log(`Deleted ${statementsSnapshot.size} stale statements.`);

    const submissionsSnapshot = await db.collection('payment_submissions').get();
    const deleteSubmissions = submissionsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deleteSubmissions);
    console.log(`Deleted ${submissionsSnapshot.size} stale payment submissions.`);

    const paymentsSnapshot = await db.collection('payments').get();
    const deletePayments = paymentsSnapshot.docs.map(doc => doc.ref.delete());
    await Promise.all(deletePayments);
    console.log(`Deleted ${paymentsSnapshot.size} stale payments.`);

    // 3. Seed 10 new real residents
    console.log("Seeding 10 real residents into Firebase Auth and Firestore...");
    const now = new Date().toISOString();

    for (let i = 0; i < realResidents.length; i++) {
      const res = realResidents[i];
      
      // Generate standard email: lastnameblknumberlotnumber@gmail.com
      const nameParts = res.name.toLowerCase().split(/\s+/);
      const lastName = nameParts[nameParts.length - 1] || 'resident';
      const cleanLastName = lastName.replace(/[^a-z]/g, '');
      const finalEmail = `${cleanLastName}blk${res.block}lot${res.lot}@gmail.com`;

      // Format Philippine phone number: +63...
      const finalPhone = res.phone.startsWith('+') ? res.phone : `+63${res.phone.replace(/^0/, '')}`;

      try {
        // Create in Firebase Auth
        const authUser = await auth.createUser({
          email: finalEmail,
          password: 'lhconnect2026', // Standard secure default password
          displayName: res.name,
          phoneNumber: finalPhone,
        });

        const newUser = {
          email: finalEmail,
          fullName: res.name,
          phone: res.phone,
          phase: res.phase,
          block: res.block,
          lot: res.lot,
          role: 'resident',
          approvalStatus: 'Approved',
          status: 'Active',
          balance: 0,
          createdAt: now,
          updatedAt: now,
        };

        // Create in Firestore
        await db.collection('users').doc(authUser.uid).set(newUser);
        console.log(`Successfully seeded: ${res.name} -> ${finalEmail}`);
      } catch (err) {
        console.error(`Failed to seed resident ${res.name}:`, err.message);
      }
    }

    console.log("Seeding completed successfully!");
  } catch (error) {
    console.error("Seeding failed with error:", error);
  } finally {
    process.exit(0);
  }
}

seed();
