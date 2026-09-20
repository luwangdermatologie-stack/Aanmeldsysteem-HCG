/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  getFirestore, 
  collection, 
  doc, 
  setDoc, 
  getDoc, 
  getDocs, 
  onSnapshot, 
  updateDoc, 
  deleteDoc, 
  writeBatch 
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification, Timesheet, StaffMember, LeaveRequest, GeneralComment, TodoItem } from './types';
import { getISOWeekDetails, isDummyPersonnel, isDummyLeaveRequest } from './services/leaveService';
import { getDetectedEnvironment, getEnvCollectionName, AppEnvironment } from './config/environment';

export { getDetectedEnvironment, getEnvCollectionName };
export type { AppEnvironment };

const app = initializeApp(firebaseConfig);
// Initialize Firestore using the configured database ID or the default database
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

/**
 * Returns a Firestore CollectionReference configured for the active environment.
 * If in 'test' (Google AI Studio), resolves to 'test_<baseName>'.
 * If in 'production' (GitHub active environment), resolves to '<baseName>'.
 */
export function col(baseName: string) {
  return collection(db, getEnvCollectionName(baseName));
}

/**
 * Returns a Firestore DocumentReference configured for the active environment.
 */
export function docRef(baseName: string, pathOrId: string, ...rest: string[]) {
  return doc(db, getEnvCollectionName(baseName), pathOrId, ...rest);
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
    },
    operationType,
    path
  };
  console.error('Firestore Error:', JSON.stringify(errInfo));
  return errInfo;
}

/**
 * Recursively removes undefined properties from an object so that it can be stored in Firestore.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

const DEFAULT_CONFIG: SystemConfig = {
  currentDagdeel: 'ochtend',
  activeStaffId: '',
  teamsWebhookUrl: 'https://defaultab36ad8b4d47498f818c594589e501.81.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/53b4ca2341fe4abe94068889ff4958bb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=UsqlL0aM6UGioEOBRFq6AbKvhJDSboH1prg0SJU8jdg',
  adminPin: '1234',
  kioskLocked: false,
  gdprAutoAnonymize: true,
  gdprRetentionHours: 24,
  lastGdprRun: new Date().toISOString()
};

/**
 * Validates Firestore database tables without inserting dummy doctors or nurses.
 * Updates never overwrite or add mock personnel.
 */
export async function initializeDatabaseIfEmpty() {
  try {
    // Clean up any remaining dummy or placeholder records across personnel and leave collections
    try {
      const purgeBatch = writeBatch(db);
      let purgeOps = 0;

      // 1. Doctors
      const docSnap = await getDocs(col('doctors'));
      docSnap.forEach(d => {
        const data = d.data() as Doctor;
        if (isDummyPersonnel(d.id, data.name)) {
          purgeBatch.delete(d.ref);
          purgeOps++;
        }
      });

      // 2. Staff
      const staffSnap = await getDocs(col('staff'));
      staffSnap.forEach(s => {
        const data = s.data() as ActiveStaff;
        if (isDummyPersonnel(s.id, data.name)) {
          purgeBatch.delete(s.ref);
          purgeOps++;
        }
      });

      // 3. Leave Staff
      const leaveStaffSnap = await getDocs(col('leave_staff'));
      leaveStaffSnap.forEach(ls => {
        const data = ls.data() as StaffMember;
        if (isDummyPersonnel(ls.id, data.name)) {
          purgeBatch.delete(ls.ref);
          purgeOps++;
        }
      });

      // 4. Leave Requests (Purge dummy, sample, or corrupt records without staff_id or date)
      const leaveReqSnap = await getDocs(col('leave_requests'));
      leaveReqSnap.forEach(lr => {
        const data = lr.data() as Partial<LeaveRequest>;
        if (isDummyLeaveRequest(data) || !data.staff_id || !data.date) {
          purgeBatch.delete(lr.ref);
          purgeOps++;
        }
      });

      if (purgeOps > 0) {
        await purgeBatch.commit();
        console.log(`[Firestore Init] Successfully purged ${purgeOps} dummy/corrupt records.`);
      }
    } catch (cleanErr) {
      console.warn('Cleanup dummy records note:', cleanErr);
    }

    const configDoc = await getDoc(docRef('config', 'system'));
    if (!configDoc.exists()) {
      console.log('Populating system config with new Webhook URL...');
      await setDoc(docRef('config', 'system'), DEFAULT_CONFIG);
    }

    // Ensure leave_config db_initialized marker is recorded without overwriting or generating mock leave requests
    const leaveInitDoc = await getDoc(docRef('leave_config', 'db_initialized'));
    if (!leaveInitDoc.exists()) {
      await setDoc(docRef('leave_config', 'db_initialized'), {
        initialized_at: new Date().toISOString(),
        version: 3
      });
      // Do NOT auto-seed fake leave requests, doctors, or staff.
      // Personnel and leave data are preserved exactly as entered by the user.
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}

/**
 * Copies real doctors and staff from the production environment (GitHub) into the test environment,
 * providing a realistic test dataset without touching production records.
 */
export async function cloneProductionStaffToTest(): Promise<{ doctorsCount: number; staffCount: number }> {
  try {
    const prodDoctorsSnap = await getDocs(collection(db, 'doctors'));
    const prodStaffSnap = await getDocs(collection(db, 'staff'));
    const prodLeaveStaffSnap = await getDocs(collection(db, 'leave_staff'));

    const batch = writeBatch(db);
    let doctorsCount = 0;
    let staffCount = 0;

    prodDoctorsSnap.forEach(d => {
      batch.set(doc(db, 'test_doctors', d.id), d.data());
      doctorsCount++;
    });

    prodStaffSnap.forEach(s => {
      batch.set(doc(db, 'test_staff', s.id), s.data());
      staffCount++;
    });

    prodLeaveStaffSnap.forEach(ls => {
      batch.set(doc(db, 'test_leave_staff', ls.id), ls.data());
    });

    await batch.commit();
    return { doctorsCount, staffCount };
  } catch (err) {
    console.error('Failed to clone production staff to test:', err);
    throw err;
  }
}

/**
 * Resets all test collections to a clean state. Never touches production data.
 */
export async function resetTestDatabase(): Promise<void> {
  try {
    // Only reset transient test kiosk/check-in data, NEVER touch leave planning
    const testCols = ['test_patients', 'test_timesheets', 'test_notifications'];
    for (const c of testCols) {
      const snap = await getDocs(collection(db, c));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
  } catch (err) {
    console.error('Failed to reset test database:', err);
    throw err;
  }
}
