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
import { INITIAL_LEAVE_STAFF, getISOWeekDetails } from './services/leaveService';
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

// Preloaded constants for populating empty tables
const INITIAL_DOCTORS: Doctor[] = [
  { id: 'dr-mertens', name: 'Dr. Elisabeth Mertens', specialty: 'Algemene Dermatologie', waitingRoom: 'Gelijkvloers', isAvailable: true, avatarColor: 'bg-teal-500' },
  { id: 'dr-vancamp', name: 'Dr. Jasper Van Camp', specialty: 'Huidkanker & Dermatochirurgie', waitingRoom: 'Bovenverdieping', isAvailable: true, avatarColor: 'bg-rose-500' },
  { id: 'dr-nilsson', name: 'Dr. Linnea Nilsson', specialty: 'Esthetische Dermatologie', waitingRoom: 'Gelijkvloers', isAvailable: true, avatarColor: 'bg-indigo-500' },
  { id: 'dr-mansour', name: 'Dr. Ahmed Mansour', specialty: 'Kinderdermatologie', waitingRoom: 'Bovenverdieping', isAvailable: true, avatarColor: 'bg-amber-500' }
];

const INITIAL_STAFF: ActiveStaff[] = [
  { id: 'staff-karina', name: 'Karina Ceusters', role: 'Hoofd Receptie & Balie' },
  { id: 'staff-steven', name: 'Steven De Coninck', role: 'Secretariaat' },
  { id: 'staff-mieke', name: 'Mieke Peeters', role: 'Medisch Assistent' }
];

const PRELOADED_PATIENTS: Patient[] = [
  {
    id: 'pat-1',
    firstName: 'Wouter',
    lastName: 'Swinnen',
    birthDate: '12/04/1978',
    nationalRegistryNum: '78.04.12-235.61',
    idCardNum: '592-8032745-12',
    appointmentTime: '08:45',
    doctorId: 'dr-mertens',
    doctorName: 'Dr. Elisabeth Mertens',
    hasAppointment: true,
    flowType: 'appointment',
    arrivalTime: '08:38:12',
    arrivalDate: '2026-06-14',
    waitingRoom: 'Gelijkvloers',
    status: 'Waiting'
  },
  {
    id: 'pat-2',
    firstName: 'Annelies',
    lastName: 'Maes',
    birthDate: '29/11/1992',
    nationalRegistryNum: '92.11.29-412.38',
    idCardNum: '592-3453821-93',
    appointmentTime: '09:12',
    doctorId: 'dr-vancamp',
    doctorName: 'Dr. Jasper Van Camp',
    hasAppointment: true,
    flowType: 'appointment',
    arrivalTime: '09:21:44',
    arrivalDate: '2026-06-14',
    waitingRoom: 'Bovenverdieping',
    status: 'Called'
  },
  {
    id: 'pat-3',
    firstName: 'Zeynep',
    lastName: 'Kaya',
    birthDate: '-',
    nationalRegistryNum: '88.05.20-112.54',
    idCardNum: '',
    hasAppointment: false,
    flowType: 'patient_info',
    arrivalTime: '09:45:01',
    arrivalDate: '2026-06-14',
    waitingRoom: 'Gelijkvloers',
    status: 'Waiting'
  }
];

/**
 * Recursively removes undefined properties from an object so that it can be stored in Firestore.
 */
export function sanitizeForFirestore<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

const DEFAULT_CONFIG: SystemConfig = {
  currentDagdeel: 'ochtend',
  activeStaffId: 'staff-karina',
  teamsWebhookUrl: 'https://defaultab36ad8b4d47498f818c594589e501.81.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/53b4ca2341fe4abe94068889ff4958bb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=UsqlL0aM6UGioEOBRFq6AbKvhJDSboH1prg0SJU8jdg',
  adminPin: '1234',
  kioskLocked: false,
  gdprAutoAnonymize: true,
  gdprRetentionHours: 24,
  lastGdprRun: new Date().toISOString()
};

/**
 * Validates Firestore database tables and pre-populates them if they are empty
 */
export async function initializeDatabaseIfEmpty() {
  try {
    const doctorsSnap = await getDocs(col('doctors'));
    if (doctorsSnap.empty) {
      console.log('Populating initial doctors for active environment...');
      const batch = writeBatch(db);
      INITIAL_DOCTORS.forEach(dr => {
        batch.set(docRef('doctors', dr.id), dr);
      });
      await batch.commit();
    }

    // Clean up "De verpleegkundige" from doctors/staff/leave_staff collections.
    // "De verpleegkundige" is strictly a kiosk-only placeholder for patients on Gelijkvloers,
    // and must never exist as a practitioner/doctor in the database.
    try {
      const nurseDoc = await getDoc(docRef('doctors', 'nurse-verpleegkundige'));
      if (nurseDoc.exists()) {
        await deleteDoc(docRef('doctors', 'nurse-verpleegkundige'));
      }
      const nurseStaffDoc = await getDoc(docRef('staff', 'nurse-verpleegkundige'));
      if (nurseStaffDoc.exists()) {
        await deleteDoc(docRef('staff', 'nurse-verpleegkundige'));
      }
      const nurseLeaveDoc = await getDoc(docRef('leave_staff', 'nurse-verpleegkundige'));
      if (nurseLeaveDoc.exists()) {
        await deleteDoc(docRef('leave_staff', 'nurse-verpleegkundige'));
      }
      const nurseLeaveDoc2 = await getDoc(docRef('leave_staff', 'staff-nurse-verpleegkundige'));
      if (nurseLeaveDoc2.exists()) {
        await deleteDoc(docRef('leave_staff', 'staff-nurse-verpleegkundige'));
      }
    } catch (cleanErr) {
      console.warn('Cleanup placeholder nurse note:', cleanErr);
    }

    const staffSnap = await getDocs(col('staff'));
    if (staffSnap.empty) {
      console.log('Populating initial staff for active environment...');
      const batch = writeBatch(db);
      INITIAL_STAFF.forEach(st => {
        batch.set(docRef('staff', st.id), st);
      });
      await batch.commit();
    }

    const patientsSnap = await getDocs(col('patients'));
    if (patientsSnap.empty) {
      console.log('Populating initial patients for active environment...');
      const batch = writeBatch(db);
      PRELOADED_PATIENTS.forEach(pat => {
        batch.set(docRef('patients', pat.id), pat);
      });
      await batch.commit();
    }

    const configDoc = await getDoc(docRef('config', 'system'));
    if (!configDoc.exists()) {
      console.log('Populating system config with new Webhook URL...');
      await setDoc(docRef('config', 'system'), DEFAULT_CONFIG);
    }

    // Initialize Leave Planning Collections
    const leaveStaffSnap = await getDocs(col('leave_staff'));
    if (leaveStaffSnap.empty) {
      console.log('Populating initial leave staff members...');
      const batch = writeBatch(db);
      INITIAL_LEAVE_STAFF.forEach(staff => {
        batch.set(docRef('leave_staff', staff.id), staff);
      });
      await batch.commit();
    }

    // Only seed initial sample leave requests, comments, and todos once
    const leaveInitDoc = await getDoc(docRef('leave_config', 'db_initialized'));
    if (!leaveInitDoc.exists()) {
      await setDoc(docRef('leave_config', 'db_initialized'), {
        initialized_at: new Date().toISOString(),
        version: 1
      });

      const leaveRequestsSnap = await getDocs(col('leave_requests'));
      if (leaveRequestsSnap.empty) {
        console.log('Populating initial sample leave requests...');
        const batch = writeBatch(db);
        const weekInfo = getISOWeekDetails(new Date());
        const wednesdayDateStr = weekInfo.days[2].dateStr;
        const thursdayDateStr = weekInfo.days[3].dateStr;
        const fridayDateStr = weekInfo.days[4].dateStr;

        const sampleRequests: LeaveRequest[] = [
          {
            id: 'req-sample-1',
            staff_id: 'staff-dr-mertens',
            staff_name: 'Dr. Elisabeth Mertens',
            date: wednesdayDateStr,
            slot: 'VM',
            units: 0.5,
            type: 'regulier',
            status: 'goedgekeurd',
            created_at: new Date().toISOString()
          },
          {
            id: 'req-sample-2',
            staff_id: 'staff-karina',
            staff_name: 'Karina Ceusters',
            date: thursdayDateStr,
            slot: 'HELE_DAG',
            units: 1.0,
            type: 'verplicht',
            status: 'goedgekeurd',
            created_at: new Date().toISOString()
          },
          {
            id: 'req-sample-3',
            staff_id: 'staff-steven',
            staff_name: 'Steven De Coninck',
            date: fridayDateStr,
            slot: 'VM',
            units: 0.5,
            type: 'verplicht',
            status: 'goedgekeurd',
            created_at: new Date().toISOString()
          }
        ];

        sampleRequests.forEach(req => {
          batch.set(docRef('leave_requests', req.id), req);
        });
        await batch.commit();
      }

      const leaveCommentsSnap = await getDocs(col('leave_comments'));
      if (leaveCommentsSnap.empty) {
        console.log('Populating initial sample leave comments...');
        const batch = writeBatch(db);
        const currentWeekId = getISOWeekDetails(new Date()).identifier;
        const sampleComment: GeneralComment = {
          id: 'comment-init-1',
          week_identifier: currentWeekId,
          author_id: 'staff-karina',
          author_name: 'Karina Ceusters',
          message: 'Gelieve verlofaanvragen voor de herfst- en eindejaarsperiode tijdig in te dienen zodat de zaalbezetting tijdig kan worden afgestemd.',
          created_at: new Date().toISOString()
        };
        batch.set(docRef('leave_comments', sampleComment.id), sampleComment);
        await batch.commit();
      }

      const leaveTodosSnap = await getDocs(col('leave_todos'));
      if (leaveTodosSnap.empty) {
        console.log('Populating initial sample leave coordinator todos...');
        const batch = writeBatch(db);
        const today = new Date();
        const nextWeekDate = new Date(today);
        nextWeekDate.setDate(today.getDate() + 5);
        const yyyy = nextWeekDate.getFullYear();
        const mm = String(nextWeekDate.getMonth() + 1).padStart(2, '0');
        const dd = String(nextWeekDate.getDate()).padStart(2, '0');

        const sampleTodos: TodoItem[] = [
          {
            id: 'todo-init-1',
            title: 'Vervanging zaalassistentie afstemmen voor donderdag (Karina afwezig)',
            deadline: `${yyyy}-${mm}-${dd}`,
            is_completed: false,
            archived: false,
            created_at: new Date().toISOString()
          },
          {
            id: 'todo-init-2',
            title: 'Wekelijkse Google Sheets verlofbackup controleren',
            deadline: `${yyyy}-${mm}-${dd}`,
            is_completed: false,
            archived: false,
            created_at: new Date().toISOString()
          },
          {
            id: 'todo-init-3',
            title: 'Personeelsplanning Q4 definitief vastleggen met directie',
            is_completed: true,
            archived: true,
            created_at: new Date(Date.now() - 86400000 * 3).toISOString()
          }
        ];

        sampleTodos.forEach(td => {
          batch.set(docRef('leave_todos', td.id), td);
        });
        await batch.commit();
      }
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
    const testCols = ['test_patients', 'test_timesheets', 'test_notifications', 'test_leave_requests', 'test_leave_comments', 'test_leave_todos'];
    for (const c of testCols) {
      const snap = await getDocs(collection(db, c));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.forEach(d => batch.delete(d.ref));
        await batch.commit();
      }
    }
    // Re-initialize clean test data
    await initializeDatabaseIfEmpty();
  } catch (err) {
    console.error('Failed to reset test database:', err);
    throw err;
  }
}
