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
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification } from './types';

import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Keep the database initialized properly
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth();

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  // We remove the throw Error so it doesn't cause uncaught promise rejections 
  // that completely break the execution flow.
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
  teamsWebhookUrl: 'https://defaultab36ad8b4d47498f818c594589e501.81.environment.api.powerplatform.com:443/powerautomate/automations/direct/workflows/53b4ca2341fe4abe94068889ff4958bb/triggers/manual/paths/invoke?api-version=1&sp=%2Ftriggers%2Fmanual%2Frun&sv=1.0&sig=UsqlL0aM6UGioEOBRFq6AbKvhJDSboH1prg0SJU8jdg'
};

/**
 * Validates Firestore database tables and pre-populates them if they are empty
 */
export async function initializeDatabaseIfEmpty() {
  try {
    const initializedDoc = await getDoc(doc(db, 'config', 'initialized'));
    if (initializedDoc.exists()) {
      return; // Already initialized, don't overwrite if collections are empty!
    }

    // Set initialized flag so we never do this again
    await setDoc(doc(db, 'config', 'initialized'), { initializedAt: new Date().toISOString() });

    const doctorsSnap = await getDocs(collection(db, 'doctors'));
    if (doctorsSnap.empty) {
      console.log('Populating initial doctors...');
      const batch = writeBatch(db);
      INITIAL_DOCTORS.forEach(dr => {
        batch.set(doc(db, 'doctors', dr.id), dr);
      });
      await batch.commit();
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
  } catch (err) {
    console.error('Error during database initialization:', err);
  }
}
