import { adminDb } from './firebase-admin';

export type AuditAction = 'Approve Resident' | 'Decline Resident' | 'Pending Resident' | 'Verify Payment' | 'Reject Payment' | 'Manual Payment' | 'Create Announcement' | 'Update Resident Details' | 'Delete Resident' | 'Delete Submission';

export async function logAuditAction(
  adminId: string,
  adminName: string,
  action: AuditAction,
  details: string,
  targetId?: string
) {
  try {
    const now = new Date();
    await adminDb.collection('audit_logs').add({
      adminId,
      adminName,
      action,
      details,
      targetId: targetId || null,
      createdAt: now.toISOString(),
      timestamp: now,
    });
    console.log(`[Audit Log] ${adminName} performed ${action}: ${details}`);
  } catch (error: any) {
    console.error('[Audit Log] Error writing audit log:', error.message);
  }
}
