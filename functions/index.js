const functions = require('firebase-functions');
const admin = require('firebase-admin');

try {
  admin.initializeApp();
} catch (e) {
  // ignore if already initialized in local dev
}

const db = admin.firestore();

// Scheduled function to prune or archive admin notifications older than 90 days.
// Deploy with: `firebase deploy --only functions:pruneAdminNotifications`
exports.pruneAdminNotifications = functions.pubsub
  .schedule('every 24 hours')
  .onRun(async (context) => {
    const TTL_DAYS = 90;
    const cutoff = Date.now() - TTL_DAYS * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(cutoff);

    console.log(`Pruning admin_notifications older than ${cutoffDate.toISOString()}`);

    try {
      const batchSize = 500;
      const q = db.collection('admin_notifications').where('createdAt', '<', cutoffDate).limit(batchSize);
      const snapshot = await q.get();

      if (snapshot.empty) {
        console.log('No old notifications to prune.');
        return null;
      }

      const batch = db.batch();
      snapshot.docs.forEach((doc) => {
        // Optionally move to an archive collection instead of deleting:
        // const archiveRef = db.collection('admin_notifications_archive').doc(doc.id);
        // batch.set(archiveRef, doc.data());
        batch.delete(doc.ref);
      });

      await batch.commit();
      console.log(`Pruned ${snapshot.size} old notifications.`);

      // If there might be more documents, this function will run again next day.
      return null;
    } catch (err) {
      console.error('Failed to prune admin notifications:', err);
      return null;
    }
  });
