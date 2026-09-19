/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification, Timesheet } from './types';
import KioskApp from './components/KioskApp';
import AdminDashboard from './components/AdminDashboard';
import PinLockModal from './components/PinLockModal';
import { executeGdprAnonymization } from './services/gdprService';
import { getAccessToken, backupTimesheetsToGoogleSheets } from './services/googleSheetsService';
import { syncStaffBetweenConfigAndLeave } from './services/leaveService';
import { 
  Monitor, 
  RotateCcw, 
  Eye, 
  Tablet, 
  LayoutGrid, 
  Layers, 
  UserPlus, 
  BriefcaseMedical,
  ShieldAlert,
  ClipboardList,
  HeartPulse,
  Lock,
  Unlock
} from 'lucide-react';
import { db, col, docRef, getDetectedEnvironment, initializeDatabaseIfEmpty, handleFirestoreError, OperationType, sanitizeForFirestore } from './firebase';
import { setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';

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
    appointmentTime: '09:12', // late compared to arrival if checking morning
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
    appointmentTime: undefined,
    doctorId: undefined,
    doctorName: undefined,
    hasAppointment: false,
    flowType: 'patient_info',
    arrivalTime: '09:45:01',
    arrivalDate: '2026-06-14',
    waitingRoom: 'Gelijkvloers',
    status: 'Waiting'
  }
];

export default function App() {
  const [viewMode, setViewMode] = useState<'split' | 'kiosk' | 'admin'>(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    if (view === 'kiosk' || view === 'admin' || view === 'split') {
      return view;
    }
    
    try {
      const stored = localStorage.getItem('derm_reception_viewmode');
      if (stored === 'kiosk' || stored === 'admin' || stored === 'split') {
        return stored;
      }
    } catch (e) {
      console.warn("localStorage not accessible", e);
    }
    return 'kiosk';
  });

  const [isLocked] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('lock') === 'true' || params.get('hideHeader') === 'true';
  });

  // Persist viewMode
  useEffect(() => {
    try {
      localStorage.setItem('derm_reception_viewmode', viewMode);
    } catch (e) {
      // Ignore
    }
  }, [viewMode]);
  
  // State synchronized with Firebase Firestore & localStorage resilient backup
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staff, setStaff] = useState<ActiveStaff[]>([]);
  const [timesheets, setTimesheets] = useState<Timesheet[]>(() => {
    try {
      const cached = localStorage.getItem('derm_timesheets_store');
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (e) {
      console.warn("Could not read local timesheets store", e);
    }
    return [];
  });
  const [systemConfig, setSystemConfig] = useState<SystemConfig>({
    currentDagdeel: 'ochtend',
    activeStaffId: 'staff-karina',
    teamsWebhookUrl: ''
  });
  const [notifications, setNotifications] = useState<TeamsNotification[]>([]);

  // Initialize DB once on mount
  useEffect(() => {
    initializeDatabaseIfEmpty();
  }, []);

  // Periodic & Daily GDPR Anonymization (Retention cleanup based on retention hours)
  useEffect(() => {
    const checkAndRunGdpr = async () => {
      if (systemConfig.gdprAutoAnonymize === false) return;

      const now = new Date();
      const lastRun = systemConfig.lastGdprRun ? new Date(systemConfig.lastGdprRun).getTime() : 0;
      const hoursSinceLastRun = (now.getTime() - lastRun) / (1000 * 60 * 60);

      // Run if more than 12 hours have passed, or never ran
      if (hoursSinceLastRun >= 12 || lastRun === 0) {
        try {
          console.log("Executing periodic GDPR retention anonymization...");
          await executeGdprAnonymization(systemConfig.gdprRetentionHours || 24);
        } catch (err) {
          console.error("GDPR automated retention scan failed:", err);
        }
      }
    };

    const timeout = setTimeout(checkAndRunGdpr, 4000);
    const interval = setInterval(checkAndRunGdpr, 30 * 60 * 1000); // Check every 30 mins
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [systemConfig.gdprAutoAnonymize, systemConfig.gdprRetentionHours, systemConfig.lastGdprRun]);

  // Automated Daily Backup of Staff Timesheets to Google Sheets at 22:00 (preserving full history)
  useEffect(() => {
    const checkAndRunGoogleSheetsBackup = async () => {
      // If auto-backup is disabled, skip
      if (systemConfig.googleSheetsBackupEnabled === false) return;

      const token = getAccessToken();
      if (!token) return; // Requires active Google session

      const now = new Date();
      const currentHour = now.getHours(); // 0-23
      const targetHour = systemConfig.googleSheetsBackupHour ?? 22; // 22:00 every evening
      const todayStr = now.toISOString().slice(0, 10);
      const lastRunDate = systemConfig.lastGoogleSheetsBackupAt ? systemConfig.lastGoogleSheetsBackupAt.slice(0, 10) : '';

      // Trigger when it is 22:00 (or later if missed earlier today) and hasn't backed up today yet
      if (currentHour >= targetHour && lastRunDate !== todayStr) {
        console.log(`[Google Sheets Auto-Backup] Dagelijkse avondrun om ${targetHour}:00 gestart...`);
        try {
          const result = await backupTimesheetsToGoogleSheets(
            token,
            timesheets,
            staff,
            systemConfig.googleSheetsSpreadsheetId
          );

          handleUpdateConfig({
            googleSheetsSpreadsheetId: result.spreadsheetId,
            googleSheetsSpreadsheetUrl: result.spreadsheetUrl,
            lastGoogleSheetsBackupAt: result.timestamp,
            lastGoogleSheetsBackupStatus: 'Success',
            lastGoogleSheetsBackupCount: result.count,
            lastGoogleSheetsBackupMessage: `${result.count} tiktijden succesvol gearchiveerd om 22:00 met historiek.`
          });
          console.log(`[Google Sheets Auto-Backup] Succesvol voltooid: ${result.count} records gesynchroniseerd.`);
        } catch (err: any) {
          console.error('[Google Sheets Auto-Backup] Fout tijdens 22:00 synchronisatie:', err);
          handleUpdateConfig({
            lastGoogleSheetsBackupStatus: 'Failed',
            lastGoogleSheetsBackupMessage: err.message || 'Fout tijdens automatische backup.'
          });
        }
      }
    };

    // Check shortly after boot and every 60 seconds
    const timeout = setTimeout(checkAndRunGoogleSheetsBackup, 6000);
    const interval = setInterval(checkAndRunGoogleSheetsBackup, 60 * 1000);
    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [
    systemConfig.googleSheetsBackupEnabled,
    systemConfig.googleSheetsBackupHour,
    systemConfig.googleSheetsSpreadsheetId,
    systemConfig.lastGoogleSheetsBackupAt,
    timesheets,
    staff
  ]);

  // Fullscreen state & handler
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const handleToggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        if (document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } else {
        if (document.exitFullscreen) {
          await document.exitFullscreen();
        }
      }
    } catch (err) {
      console.warn("Fullscreen toggle failed (e.g. within iframe):", err);
    }
  };

  // PIN-Lock & RBAC security modal state
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [pinModalContext, setPinModalContext] = useState<{
    title: string;
    subtitle: string;
    onSuccess: () => void;
  } | null>(null);

  const handleOpenPinModal = (options: { title: string; subtitle: string; onSuccess: () => void }) => {
    setPinModalContext(options);
    setIsPinModalOpen(true);
  };

  const handleRequestViewChange = (targetView: 'split' | 'kiosk' | 'admin') => {
    // If kiosk is currently locked, leaving kiosk or opening admin requires PIN verification
    if (systemConfig.kioskLocked && (viewMode === 'kiosk' || targetView === 'admin')) {
      handleOpenPinModal({
        title: 'Beveiligde Toegang (Admin)',
        subtitle: 'Voer de 4-cijferige balie-pincode in om van weergave te wisselen of het beheerportaal te openen.',
        onSuccess: () => {
          setViewMode(targetView);
        }
      });
      return;
    }
    setViewMode(targetView);
  };

  const handleKioskStaffUnlock = () => {
    handleOpenPinModal({
      title: 'Kiosk Ontgrendelen / Instellingen',
      subtitle: 'Voer de 4-cijferige pincode in om de kiosk-vergrendeling in of uit te schakelen.',
      onSuccess: () => {
        const newLockState = !systemConfig.kioskLocked;
        handleUpdateConfig({ kioskLocked: newLockState });
      }
    });
  };

  const handleLockAdmin = () => {
    handleUpdateConfig({ kioskLocked: true });
    setViewMode('kiosk');
  };

  const handleOpenAdminWithPin = () => {
    handleOpenPinModal({
      title: 'Beheerder Toegang (Backend)',
      subtitle: 'Voer de 4-cijferige balie-pincode in om naar de admin modus te gaan.',
      onSuccess: () => {
        setViewMode('admin');
      }
    });
  };

  const [currentEnv, setCurrentEnv] = useState<string>(getDetectedEnvironment());

  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e.detail?.environment || getDetectedEnvironment();
      setCurrentEnv(newEnv);
    };
    window.addEventListener('hcg_environment_changed', handleEnvChange);
    return () => window.removeEventListener('hcg_environment_changed', handleEnvChange);
  }, []);

  // Sync Patients
  useEffect(() => {
    const unsubscribe = onSnapshot(col('patients'), (snapshot) => {
      const patientList: Patient[] = [];
      snapshot.forEach((doc) => {
        patientList.push(doc.data() as Patient);
      });
      // Sort patients descending based on arrivalTime or id so newer show up first
      patientList.sort((a, b) => b.id.localeCompare(a.id));
      setPatients(patientList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'patients');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Sync Timesheets
  useEffect(() => {
    const unsubscribe = onSnapshot(col('timesheets'), (snapshot) => {
      const firestoreTs: Timesheet[] = [];
      snapshot.forEach((doc) => {
        firestoreTs.push(doc.data() as Timesheet);
      });

      setTimesheets(prev => {
        const map = new Map<string, Timesheet>();
        // 1. Keep any existing entries in memory
        prev.forEach(ts => { if (ts && ts.id) map.set(ts.id, ts); });
        
        // 2. Check localStorage backup
        try {
          const stored = localStorage.getItem('derm_timesheets_store');
          if (stored) {
            const list: Timesheet[] = JSON.parse(stored);
            list.forEach(ts => { if (ts && ts.id) map.set(ts.id, ts); });
          }
        } catch (e) {
          // ignore error
        }

        // 3. Overwrite / merge with live Firestore documents
        firestoreTs.forEach(ts => { if (ts && ts.id) map.set(ts.id, ts); });

        const merged = Array.from(map.values());
        try {
          localStorage.setItem('derm_timesheets_store', JSON.stringify(merged));
        } catch (e) {
          // ignore error
        }

        // 4. Auto-save any local records that weren't in Firestore yet
        const remoteIds = new Set(firestoreTs.map(t => t.id));
        merged.forEach(async (localTs) => {
          if (!remoteIds.has(localTs.id)) {
            try {
              await setDoc(docRef('timesheets', localTs.id), sanitizeForFirestore(localTs));
            } catch (err) {
              console.warn("Auto-syncing cached timesheet to Firestore:", err);
            }
          }
        });

        return merged;
      });
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'timesheets');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Sync Doctors
  useEffect(() => {
    const unsubscribe = onSnapshot(col('doctors'), (snapshot) => {
      const doctorsList: Doctor[] = [];
      snapshot.forEach((doc) => {
        const d = doc.data() as Doctor;
        // Strictly ignore and exclude the kiosk placeholder "De verpleegkundige"
        if (
          d.id !== 'nurse-verpleegkundige' &&
          d.name?.toLowerCase().trim() !== 'de verpleegkundige' &&
          d.name?.toLowerCase().trim() !== 'verpleegkundige'
        ) {
          doctorsList.push(d);
        }
      });
      // Keep doctors in order or sort by id
      doctorsList.sort((a, b) => a.id.localeCompare(b.id));
      setDoctors(doctorsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'doctors');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Sync Staff
  useEffect(() => {
    const unsubscribe = onSnapshot(col('staff'), (snapshot) => {
      const staffList: ActiveStaff[] = [];
      snapshot.forEach((doc) => {
        const s = doc.data() as ActiveStaff;
        if (
          s.id !== 'nurse-verpleegkundige' &&
          s.name?.toLowerCase().trim() !== 'de verpleegkundige' &&
          s.name?.toLowerCase().trim() !== 'verpleegkundige'
        ) {
          staffList.push(s);
        }
      });
      staffList.sort((a, b) => a.id.localeCompare(b.id));
      setStaff(staffList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'staff');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Automatic Staff Synchronization on initial load between Configuratie & Reset and Verlofplanning
  const initialSyncTriggeredRef = useRef(false);
  useEffect(() => {
    if (!initialSyncTriggeredRef.current && staff.length > 0 && doctors.length > 0) {
      initialSyncTriggeredRef.current = true;
      syncStaffBetweenConfigAndLeave(staff, doctors).catch(err => {
        console.warn("Background initial sync staff warning:", err);
      });
    }
  }, [staff, doctors]);

  // Sync Config
  useEffect(() => {
    const unsubscribe = onSnapshot(docRef('config', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemConfig(snapshot.data() as SystemConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/system');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Sync Notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(col('notifications'), (snapshot) => {
      const notificationsList: TeamsNotification[] = [];
      snapshot.forEach((doc) => {
        notificationsList.push(doc.data() as TeamsNotification);
      });
      notificationsList.sort((a, b) => b.id.localeCompare(a.id));
      setNotifications(notificationsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'notifications');
    });
    return () => unsubscribe();
  }, [currentEnv]);

  // Handle register from Kiosk
  const handlePatientRegister = async (newPatientData: Omit<Patient, 'id' | 'arrivalTime' | 'arrivalDate' | 'waitingRoom' | 'status'>) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    const dateStr = now.toISOString().split('T')[0];

    const doctor = doctors.find(d => d.id === newPatientData.doctorId);
    const isNurse = (doctor?.id === 'nurse-verpleegkundige') || (newPatientData.doctorName?.toLowerCase().includes('verpleegkundige'));
    const resolvedRoom = isNurse ? 'Gelijkvloers' : (doctor ? doctor.waitingRoom : 'Gelijkvloers');

    const fullPatient: Patient = {
      ...newPatientData,
      id: `pat-${Date.now()}`,
      arrivalTime: timeStr,
      arrivalDate: dateStr,
      waitingRoom: resolvedRoom,
      status: 'Waiting'
    };

    try {
      await setDoc(docRef('patients', fullPatient.id), sanitizeForFirestore(fullPatient));
    } catch (err) {
      console.error("Error adding patient to firestore:", err);
    }
  };

  // Dispatch MS Teams Notification & Save
  const handleTeamsNotify = async (messageText: string, target?: string, payload?: any): Promise<boolean> => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const newLogItem: TeamsNotification = {
      id: `notif-${Date.now()}`,
      timestamp: timeStr,
      targetDoctor: target,
      sender: payload?.sender || 'Kiosk Balie',
      category: payload?.category || (payload?.type === 'Chatbericht' ? 'chat' : 'aanmelding'),
      payload,
      messagePreview: messageText,
      status: 'Simulated'
    };

    let targetWebhookUrl = systemConfig.teamsWebhookUrl;

    if (target) {
      const docMatch = doctors.find(d => d.name === target);
      if (docMatch && docMatch.teamsWebhookUrl && docMatch.teamsWebhookUrl.startsWith('http')) {
        targetWebhookUrl = docMatch.teamsWebhookUrl;
      }
    }

    let isSuccess = false;

    if (targetWebhookUrl && targetWebhookUrl.startsWith('http')) {
      try {
        const response = await fetch('/api/teams-notify', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            webhookUrl: targetWebhookUrl,
            messageText,
            title: payload?.title || (payload?.type === 'Chatbericht' ? "Huidcentrum Gent - Balie Teams Chat" : "Huidcentrum Gent - Kiosk Aanmelding"),
            payload
          })
        });
        
        if (response.ok) {
          newLogItem.status = 'Success';
          isSuccess = true;
        } else {
          newLogItem.status = 'Failed';
          console.error("Teams proxy dispatch returned error status");
        }
      } catch (err) {
        newLogItem.status = 'Failed';
        console.error("Teams webhook dispatch failed due to networking. Logged as failed.", err);
      }
    } else {
      // If no webhook URL configured, it is logged as Simulated in the logbook
      isSuccess = true;
    }

    try {
      await setDoc(docRef('notifications', newLogItem.id), sanitizeForFirestore(newLogItem));
    } catch (err) {
      console.error("Error adding notification to firestore:", err);
    }

    return isSuccess;
  };

  // Consistent system configuration updates (sync with Firestore and local State)
  const handleUpdateConfig = async (conf: Partial<SystemConfig>) => {
    try {
      setSystemConfig(prev => ({ ...prev, ...conf }));
      await updateDoc(docRef('config', 'system'), conf);
    } catch (err) {
      console.error("Error updating system config in firestore:", err);
    }
  };

  // Patient manual status transition from table
  const handleUpdatePatientStatus = async (patientId: string, newStatus: Patient['status']) => {
    try {
      await updateDoc(docRef('patients', patientId), { status: newStatus });
    } catch (err) {
      console.error("Error updating patient status in firestore:", err);
    }
  };

  // Half-day dagdeel transition reset
  const handleResetDagdeel = async (options: {
    clearPatients: boolean;
    reassignRooms: Record<string, 'Gelijkvloers' | 'Bovenverdieping'>;
    supportStaffId: string;
    nextPeriod: 'ochtend' | 'middag';
  }) => {
    try {
      if (options.clearPatients) {
        const batch = writeBatch(db);
        patients.forEach(p => {
          if (p.status !== 'Archived') {
            batch.update(docRef('patients', p.id), { status: 'Archived' });
          }
        });
        await batch.commit();
      }

      const drBatch = writeBatch(db);
      doctors.forEach(dr => {
        const newRoom = options.reassignRooms[dr.id];
        if (newRoom) {
          drBatch.update(docRef('doctors', dr.id), { waitingRoom: newRoom });
        }
      });
      await drBatch.commit();

      await updateDoc(docRef('config', 'system'), {
        currentDagdeel: options.nextPeriod,
        activeStaffId: options.supportStaffId
      });
    } catch (err) {
      console.error("Error resetting dagdeel in firestore:", err);
    }
  };

  const handleClearNotifications = async () => {
    try {
      const batch = writeBatch(db);
      notifications.forEach(n => {
        batch.delete(docRef('notifications', n.id));
      });
      await batch.commit();
    } catch (err) {
      console.error("Error clearing notifications in firestore:", err);
    }
  };

  const handleUpdateDoctors = async (updatedDoctors: Doctor[]) => {
    try {
      const deleted = doctors.filter(dr => !updatedDoctors.some(u => u.id === dr.id));
      for (const dr of deleted) {
        await deleteDoc(docRef('doctors', dr.id)).catch(() => {});
        await deleteDoc(docRef('leave_staff', dr.id)).catch(() => {});
        await deleteDoc(docRef('leave_staff', `staff-${dr.id}`)).catch(() => {});
      }
      const batch = writeBatch(db);
      updatedDoctors.forEach(dr => {
        batch.set(docRef('doctors', dr.id), dr);
      });
      await batch.commit();

      // Automatically sync with Verlofplanning
      syncStaffBetweenConfigAndLeave(staff, updatedDoctors).catch(err => {
        console.warn("Auto sync doctors after update warning:", err);
      });
    } catch (err) {
      console.error("Error updating doctors in firestore:", err);
    }
  };

  const handleUpdateStaff = async (updatedStaff: ActiveStaff[]) => {
    try {
      const deleted = staff.filter(st => !updatedStaff.some(u => u.id === st.id));
      for (const st of deleted) {
        await deleteDoc(docRef('staff', st.id)).catch(() => {});
        await deleteDoc(docRef('leave_staff', st.id)).catch(() => {});
      }
      const batch = writeBatch(db);
      updatedStaff.forEach(st => {
        batch.set(docRef('staff', st.id), st);
      });
      await batch.commit();

      // Automatically sync with Verlofplanning
      syncStaffBetweenConfigAndLeave(updatedStaff, doctors).catch(err => {
        console.warn("Auto sync staff after update warning:", err);
      });
    } catch (err) {
      console.error("Error updating staff in firestore:", err);
    }
  };

  const handleUpdateTimesheet = async (timesheet: Timesheet) => {
    // 1. Instantly update local state and localStorage for zero-latency, unbreakable persistence
    setTimesheets(prev => {
      const next = prev.filter(t => t.id !== timesheet.id);
      next.push(timesheet);
      try {
        localStorage.setItem('derm_timesheets_store', JSON.stringify(next));
      } catch (e) {
        // ignore error
      }
      return next;
    });

    // 2. Persist to Firestore database
    try {
      await setDoc(docRef('timesheets', timesheet.id), sanitizeForFirestore(timesheet));
    } catch (err) {
      console.error("Error updating timesheet in firestore:", err);
    }
  };

  const handleDeleteTimesheet = async (id: string) => {
    // 1. Instantly update local state and localStorage
    setTimesheets(prev => {
      const next = prev.filter(t => t.id !== id);
      try {
        localStorage.setItem('derm_timesheets_store', JSON.stringify(next));
      } catch (e) {
        // ignore error
      }
      return next;
    });

    // 2. Delete from Firestore database
    try {
      await deleteDoc(docRef('timesheets', id));
    } catch (err) {
      console.error("Error deleting timesheet in firestore:", err);
    }
  };

  const handleRestoreTimesheets = async (restoredList: Timesheet[]): Promise<void> => {
    // 1. Update state & localStorage
    setTimesheets(restoredList);
    try {
      localStorage.setItem('derm_timesheets_store', JSON.stringify(restoredList));
    } catch (e) {
      // ignore
    }

    // 2. Overwrite in Firestore
    try {
      const batch = writeBatch(db);
      const existingSnap = await getDocs(col('timesheets'));
      existingSnap.forEach(d => {
        batch.delete(docRef('timesheets', d.id));
      });
      restoredList.forEach(ts => {
        batch.set(docRef('timesheets', ts.id), sanitizeForFirestore(ts));
      });
      await batch.commit();
    } catch (err) {
      console.error("Error restoring timesheets to Firestore:", err);
      throw err;
    }
  };

  const handleResetEntireData = async () => {
    if (confirm("🚨 Dit zal alle opgeslagen cliënten en instellingen volledig terugzetten naar de fabrieksinstellingen. Doorgaan?")) {
      try {
        const batch = writeBatch(db);
        patients.forEach(p => {
          batch.delete(docRef('patients', p.id));
        });
        doctors.forEach(d => {
          batch.delete(docRef('doctors', d.id));
        });
        staff.forEach(s => {
          batch.delete(docRef('staff', s.id));
        });
        notifications.forEach(n => {
          batch.delete(docRef('notifications', n.id));
        });
        await batch.commit();

        await setDoc(docRef('config', 'system'), {
          currentDagdeel: 'ochtend',
          activeStaffId: 'staff-karina',
          teamsWebhookUrl: ''
        });

        await initializeDatabaseIfEmpty();
        alert("🔄 Systeem hersteld!");
      } catch (err) {
        console.error("Error resetting database:", err);
      }
    }
  };

  const checkIsLate = (enteredTime: string): boolean => {
    if (!enteredTime) return false;
    const now = new Date();
    const [entHours, entMins] = enteredTime.split(':').map(Number);
    if (isNaN(entHours) || isNaN(entMins)) return false;
    
    // Set a clear comparison: compare hour and minute of today only!
    const currentMinutesSinceMidnight = now.getHours() * 60 + now.getMinutes();
    const enteredMinutesSinceMidnight = entHours * 60 + entMins;

    // A patient is only humanly/clinically late if they arrive MORE THAN 5 minutes after their appointment time.
    // This 5-minute grace period prevents false webhook triggers for patients checking in "on-time" or within a normal window.
    const gracePeriodMinutes = 5;
    return currentMinutesSinceMidnight > (enteredMinutesSinceMidnight + gracePeriodMinutes);
  };

  // Simulated rapid checkin assistant for easy demoing
  const handleAddRandomSimulatedPatient = () => {
    const firstNames = ['Matthias', 'Charlotte', 'Lina', 'Daan', 'Fatima', 'Yusuf', 'Jean-Pierre'];
    const lastNames = ['Claes', 'Vermeersch', 'Dewilde', 'El Amrani', 'Dumoulin', 'Kose', 'Stynen'];
    const randomFirst = firstNames[Math.floor(Math.random() * firstNames.length)];
    const randomLast = lastNames[Math.floor(Math.random() * lastNames.length)];
    const randomDr = doctors[Math.floor(Math.random() * doctors.length)];
    const now = new Date();
    const offset = Math.random() > 0.5 ? 15 : -15; 
    now.setMinutes(now.getMinutes() + offset);
    const mockApptHour = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' });
    const mockReg = `${Math.floor(Math.random() * 25 + 75)}.06.14-${Math.floor(Math.random() * 800 + 100)}.${Math.floor(Math.random() * 80 + 10)}`;

    handlePatientRegister({
      firstName: randomFirst,
      lastName: randomLast,
      birthDate: '15/06/1988',
      nationalRegistryNum: mockReg,
      idCardNum: `592-${Math.floor(Math.random() * 8999999 + 1000000)}-${Math.floor(Math.random() * 89 + 10)}`,
      appointmentTime: mockApptHour,
      doctorId: randomDr.id,
      doctorName: randomDr.name,
      hasAppointment: true,
      flowType: 'appointment'
    });

    const isLate = checkIsLate(mockApptHour);
    if (isLate) {
      const teamsMessage = `⚠️ **Patiënt is te laat (Simulatie)**: ${randomFirst} ${randomLast} is zojuist aangemeld voor de afspraak van **${mockApptHour}** bij **${randomDr.name}** (Status: <strong style="color:#d50000; font-size:15px; font-weight:bold;">⚠️ TE LAAT</strong>).`;
      handleTeamsNotify(teamsMessage, randomDr.name, {
        Naam: `${randomFirst} ${randomLast}`,
        Dokter: randomDr.name,
        Type: "Te late patiënt (Simulatie)",
        Tijdstip: mockApptHour,
        Geboortedatum: '15/06/1988',
        "Rijksregisternummer": mockReg,
        "Status": "⚠️ TE LAAT (ROOD/VET/OPVALLEND)",
        "Wachtzaal": randomDr.waitingRoom === 'Gelijkvloers' ? 'Gelijkvloers (G)' : 'Bovenverdieping (B)',
        simulated: true
      });
    }
  };

  return (
    <div className="min-h-screen font-sans flex flex-col selection:bg-[#0071E3] selection:text-white relative bg-[#f7f9fc] text-slate-800" id="applet-root">
      
      {/* CORE WORKSPACE CONTENT PANEL - FULL SCREEN EDGE-TO-EDGE */}
      <main className="relative z-10 flex-1 w-full flex flex-col justify-stretch p-0 m-0 max-w-none h-full min-h-screen">
        
        {/* VIEW 1: DUAL-VIEW SPLIT LIVE SYNC SIMULATION (EDGE-TO-EDGE) */}
        {viewMode === 'split' && (
          <div className="flex-1 w-full h-full min-h-screen flex flex-col p-0 m-0 bg-slate-100">
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-0 items-stretch w-full">
              {/* LEFT 5 COLUMNS: THE TABLET KIOSK (CLEAN BORDERLESS VIEW) */}
              <div className="lg:col-span-5 flex flex-col bg-white border-r border-slate-200 overflow-hidden">
                <KioskApp 
                  doctors={doctors}
                  onPatientRegister={handlePatientRegister}
                  onTeamsNotify={handleTeamsNotify}
                  isKioskLocked={systemConfig.kioskLocked ?? false}
                  onRequestStaffUnlock={handleKioskStaffUnlock}
                  onToggleFullscreen={handleToggleFullscreen}
                  isFullscreen={isFullscreen}
                  onOpenAdmin={() => handleRequestViewChange('admin')}
                  onOpenAdminWithPin={handleOpenAdminWithPin}
                  onOpenSplit={() => handleRequestViewChange('split')}
                />
              </div>

              {/* RIGHT 7 COLUMNS: SECRETARIAAT ADMIN (CLEAN BORDERLESS VIEW) */}
              <div className="lg:col-span-7 flex flex-col bg-white overflow-hidden">
                <AdminDashboard 
                  patients={patients}
                  doctors={doctors}
                  activeStaffList={staff}
                  timesheets={timesheets}
                  systemConfig={systemConfig}
                  notifications={notifications}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdateDoctors={handleUpdateDoctors}
                  onUpdateStaff={handleUpdateStaff}
                  onUpdatePatientStatus={handleUpdatePatientStatus}
                  onResetDagdeel={handleResetDagdeel}
                  onClearNotificationLog={handleClearNotifications}
                  onAddSimulatedPatient={handleAddRandomSimulatedPatient}
                  onUpdateTimesheet={handleUpdateTimesheet}
                  onDeleteTimesheet={handleDeleteTimesheet}
                  onLockAdmin={handleLockAdmin}
                  onRunGdprAnonymize={() => executeGdprAnonymization(systemConfig.gdprRetentionHours || 24)}
                  onTeamsNotify={handleTeamsNotify}
                  onSwitchView={(v) => handleRequestViewChange(v)}
                  onRestoreTimesheets={handleRestoreTimesheets}
                />
              </div>
            </div>
          </div>
        )}

        {/* VIEW 2: FULLSCREEN TABLET TERMINAL (EDGE-TO-EDGE) */}
        {viewMode === 'kiosk' && (
          <div className="w-full flex-1 flex flex-col items-stretch h-full min-h-screen">
            <KioskApp 
              doctors={doctors}
              onPatientRegister={handlePatientRegister}
              onTeamsNotify={handleTeamsNotify}
              isKioskLocked={systemConfig.kioskLocked ?? false}
              onRequestStaffUnlock={handleKioskStaffUnlock}
              onToggleFullscreen={handleToggleFullscreen}
              isFullscreen={isFullscreen}
              onOpenAdmin={() => handleRequestViewChange('admin')}
              onOpenAdminWithPin={handleOpenAdminWithPin}
              onOpenSplit={() => handleRequestViewChange('split')}
            />
          </div>
        )}

        {/* VIEW 3: FULLSCREEN WEB RECEPTION SYSTEM (EDGE-TO-EDGE) */}
        {viewMode === 'admin' && (
          <div className="w-full flex-1 flex flex-col items-stretch h-full min-h-screen">
            <AdminDashboard 
              patients={patients}
              doctors={doctors}
              activeStaffList={staff}
              timesheets={timesheets}
              systemConfig={systemConfig}
              notifications={notifications}
              onUpdateConfig={handleUpdateConfig}
              onUpdateDoctors={handleUpdateDoctors}
              onUpdateStaff={handleUpdateStaff}
              onUpdatePatientStatus={handleUpdatePatientStatus}
              onResetDagdeel={handleResetDagdeel}
              onClearNotificationLog={handleClearNotifications}
              onAddSimulatedPatient={handleAddRandomSimulatedPatient}
              onUpdateTimesheet={handleUpdateTimesheet}
              onDeleteTimesheet={handleDeleteTimesheet}
              onLockAdmin={handleLockAdmin}
              onRunGdprAnonymize={() => executeGdprAnonymization(systemConfig.gdprRetentionHours || 24)}
              onTeamsNotify={handleTeamsNotify}
              onSwitchView={(v) => handleRequestViewChange(v)}
              onRestoreTimesheets={handleRestoreTimesheets}
              onSyncStaff={async () => {
                await syncStaffBetweenConfigAndLeave(staff, doctors);
              }}
            />
          </div>
        )}

      </main>

      {/* PIN LOCK SECURITY MODAL */}
      <PinLockModal
        isOpen={isPinModalOpen}
        expectedPin={systemConfig.adminPin || '1234'}
        title={pinModalContext?.title || 'Balie Beveiliging'}
        subtitle={pinModalContext?.subtitle || 'Voer de 4-cijferige pincode in om toegang te krijgen.'}
        onSuccess={() => {
          setIsPinModalOpen(false);
          if (pinModalContext?.onSuccess) {
            pinModalContext.onSuccess();
          }
        }}
        onCancel={() => {
          setIsPinModalOpen(false);
          setPinModalContext(null);
        }}
      />
    </div>
  );
}
