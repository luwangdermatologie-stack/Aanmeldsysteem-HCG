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

const app = initializeApp(firebaseConfig);
// Initialize Firestore using the configured database ID or the default database
export const db = (firebaseConfig as any).firestoreDatabaseId
  ? getFirestore(app, (firebaseConfig as any).firestoreDatabaseId)
  : getFirestore(app);
export const auth = getAuth(app);

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
  { id: 'dr-mansour', name: 'Dr. Ahmed Mansour', specialty: 'Kinderdermatologie', waitingRoom: 'Bovenverdieping', isAvailable: true, avatarColor: 'bg-amber-500' },
  { id: 'nurse-verpleegkundige', name: 'De verpleegkundige', specialty: 'Verpleegkundige zorg & Wondzorg', waitingRoom: 'Gelijkvloers', isAvailable: true, avatarColor: 'bg-emerald-500' }
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
    const doctorsSnap = await getDocs(collection(db, 'doctors'));
    if (doctorsSnap.empty) {
      console.log('Populating initial doctors...');
      const batch = writeBatch(db);
      INITIAL_DOCTORS.forEach(dr => {
        batch.set(doc(db, 'doctors', dr.id), dr);
      });
      await batch.commit();
    } else {
      // Ensure "De verpleegkundige" is always present even if database was already initialized
      const nurseDoc = await getDoc(doc(db, 'doctors', 'nurse-verpleegkundige'));
      if (!nurseDoc.exists()) {
        await setDoc(doc(db, 'doctors', 'nurse-verpleegkundige'), {
          id: 'nurse-verpleegkundige',
          name: 'De verpleegkundige',
          specialty: 'Verpleegkundige zorg & Wondzorg',
          waitingRoom: 'Gelijkvloers',
          isAvailable: true,
          avatarColor: 'bg-emerald-500'
        });
      }
    }

    const staffSnap = await getDocs(collection(db, 'staff'));
    if (staffSnap.empty) {
      console.log('Populating initial staff...');
      const batch = writeBatch(db);
      INITIAL_STAFF.forEach(st => {
        batch.set(doc(db, 'staff', st.id), st);
      });
      await batch.commit();
    }

    const patientsSnap = await getDocs(collection(db, 'patients'));
    if (patientsSnap.empty) {
      console.log('Populating initial patients...');
      const batch = writeBatch(db);
      PRELOADED_PATIENTS.forEach(pat => {
        batch.set(doc(db, 'patients', pat.id), pat);
      });
      await batch.commit();
    }

    const configDoc = await getDoc(doc(db, 'config', 'system'));
    if (!configDoc.exists()) {
      console.log('Populating system config with new Webhook URL...');
      await setDoc(doc(db, 'config', 'system'), DEFAULT_CONFIG);
    }

    // Initialize Leave Planning Collections
    const leaveStaffSnap = await getDocs(collection(db, 'leave_staff'));
    if (leaveStaffSnap.empty) {
      console.log('Populating initial leave staff members...');
      const batch = writeBatch(db);
      INITIAL_LEAVE_STAFF.forEach(staff => {
        batch.set(doc(db, 'leave_staff', staff.id), staff);
      });
      await batch.commit();
    }

    const leaveRequestsSnap = await getDocs(collection(db, 'leave_requests'));
    if (leaveRequestsSnap.empty) {
      console.log('Populating initial sample leave requests...');
      const batch = writeBatch(db);
      const weekInfo = getISOWeekDetails(new Date());
      const wednesdayDateStr = weekInfo.days[2].dateStr; // Wednesday this week
      const thursdayDateStr = weekInfo.days[3].dateStr;  // Thursday this week
      const fridayDateStr = weekInfo.days[4].dateStr;    // Friday this week

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
          status: 'aangevraagd',
          created_at: new Date().toISOString()
        }
      ];

      sampleRequests.forEach(req => {
        batch.set(doc(db, 'leave_requests', req.id), req);
      });
      await batch.commit();
    }

    const leaveCommentsSnap = await getDocs(collection(db, 'leave_comments'));
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
      batch.set(doc(db, 'leave_comments', sampleComment.id), sampleComment);
      await batch.commit();
    }

    const leaveTodosSnap = await getDocs(collection(db, 'leave_todos'));
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
        batch.set(doc(db, 'leave_todos', td.id), td);
      });
      await batch.commit();
    }
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}
