/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification, Timesheet } from './types';
import KioskApp from './components/KioskApp';
import AdminDashboard from './components/AdminDashboard';
import PinLockModal from './components/PinLockModal';
import { executeGdprAnonymization } from './services/gdprService';
import { getAccessToken, backupTimesheetsToGoogleSheets } from './services/googleSheetsService';
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
import { db, initializeDatabaseIfEmpty, handleFirestoreError, OperationType, sanitizeForFirestore } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch, getDocs } from 'firebase/firestore';

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

  // Sync Patients
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'patients'), (snapshot) => {
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
  }, []);

  // Sync Timesheets
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'timesheets'), (snapshot) => {
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
              await setDoc(doc(db, 'timesheets', localTs.id), sanitizeForFirestore(localTs));
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
  }, []);

  // Sync Doctors
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'doctors'), (snapshot) => {
      const doctorsList: Doctor[] = [];
      snapshot.forEach((doc) => {
        doctorsList.push(doc.data() as Doctor);
      });
      // Keep doctors in order or sort by id
      doctorsList.sort((a, b) => a.id.localeCompare(b.id));
      setDoctors(doctorsList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'doctors');
    });
    return () => unsubscribe();
  }, []);

  // Sync Staff
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'staff'), (snapshot) => {
      const staffList: ActiveStaff[] = [];
      snapshot.forEach((doc) => {
        staffList.push(doc.data() as ActiveStaff);
      });
      staffList.sort((a, b) => a.id.localeCompare(b.id));
      setStaff(staffList);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'staff');
    });
    return () => unsubscribe();
  }, []);

  // Sync Config
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'config', 'system'), (snapshot) => {
      if (snapshot.exists()) {
        setSystemConfig(snapshot.data() as SystemConfig);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'config/system');
    });
    return () => unsubscribe();
  }, []);

  // Sync Notifications
  useEffect(() => {
    const unsubscribe = onSnapshot(collection(db, 'notifications'), (snapshot) => {
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
  }, []);

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
      await setDoc(doc(db, 'patients', fullPatient.id), sanitizeForFirestore(fullPatient));
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
      await setDoc(doc(db, 'notifications', newLogItem.id), sanitizeForFirestore(newLogItem));
    } catch (err) {
      console.error("Error adding notification to firestore:", err);
    }

    return isSuccess;
  };

  // Consistent system configuration updates (sync with Firestore and local State)
  const handleUpdateConfig = async (conf: Partial<SystemConfig>) => {
    try {
      setSystemConfig(prev => ({ ...prev, ...conf }));
      await updateDoc(doc(db, 'config', 'system'), conf);
    } catch (err) {
      console.error("Error updating system config in firestore:", err);
    }
  };

  // Patient manual status transition from table
  const handleUpdatePatientStatus = async (patientId: string, newStatus: Patient['status']) => {
    try {
      await updateDoc(doc(db, 'patients', patientId), { status: newStatus });
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
            batch.update(doc(db, 'patients', p.id), { status: 'Archived' });
          }
        });
        await batch.commit();
      }

      const drBatch = writeBatch(db);
      doctors.forEach(dr => {
        const newRoom = options.reassignRooms[dr.id];
        if (newRoom) {
          drBatch.update(doc(db, 'doctors', dr.id), { waitingRoom: newRoom });
        }
      });
      await drBatch.commit();

      await updateDoc(doc(db, 'config', 'system'), {
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
        batch.delete(doc(db, 'notifications', n.id));
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
        await deleteDoc(doc(db, 'doctors', dr.id));
      }
      const batch = writeBatch(db);
      updatedDoctors.forEach(dr => {
        batch.set(doc(db, 'doctors', dr.id), dr);
      });
      await batch.commit();
    } catch (err) {
      console.error("Error updating doctors in firestore:", err);
    }
  };

  const handleUpdateStaff = async (updatedStaff: ActiveStaff[]) => {
    try {
      const deleted = staff.filter(st => !updatedStaff.some(u => u.id === st.id));
      for (const st of deleted) {
        await deleteDoc(doc(db, 'staff', st.id));
      }
      const batch = writeBatch(db);
      updatedStaff.forEach(st => {
        batch.set(doc(db, 'staff', st.id), st);
      });
      await batch.commit();
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
      await setDoc(doc(db, 'timesheets', timesheet.id), sanitizeForFirestore(timesheet));
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
      await deleteDoc(doc(db, 'timesheets', id));
    } catch (err) {
      console.error("Error deleting timesheet in firestore:", err);
    }
  };

  const handleResetEntireData = async () => {
    if (confirm("🚨 Dit zal alle opgeslagen cliënten en instellingen volledig terugzetten naar de fabrieksinstellingen. Doorgaan?")) {
      try {
        const batch = writeBatch(db);
        patients.forEach(p => {
          batch.delete(doc(db, 'patients', p.id));
        });
        doctors.forEach(d => {
          batch.delete(doc(db, 'doctors', d.id));
        });
        staff.forEach(s => {
          batch.delete(doc(db, 'staff', s.id));
        });
        notifications.forEach(n => {
          batch.delete(doc(db, 'notifications', n.id));
        });
        await batch.commit();

        await setDoc(doc(db, 'config', 'system'), {
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
    <div className={`min-h-screen font-sans flex flex-col justify-between selection:bg-[#0071E3] selection:text-white relative ${
      viewMode === 'kiosk' 
        ? 'bg-[#f1f5f9] text-slate-800' 
        : 'bg-[#0d1117] text-slate-100 overflow-x-hidden'
    }`} id="applet-root">
      
      {/* Dynamic Apple Ambient Glow Orbs in Background (only for split and admin views) */}
      {viewMode !== 'kiosk' && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/15 rounded-full blur-[120px]"></div>
          <div className="absolute top-1/3 -right-40 w-96 h-96 bg-indigo-500/10 rounded-full blur-[140px]"></div>
          <div className="absolute -bottom-40 left-1/3 w-96 h-96 bg-sky-500/10 rounded-full blur-[130px]"></div>
        </div>
      )}

      {/* GLOBAL SIMULATION BAR - APPLE GLASS TOP HEADER (Hidden on clean kiosk unless unlocked/requested) */}
      {!isLocked && (
        <header className={`relative z-20 border-b px-4 sm:px-6 py-2.5 flex flex-col md:flex-row justify-between items-center gap-2.5 sticky top-0 ${
          viewMode === 'kiosk'
            ? 'bg-white/80 backdrop-blur-md border-slate-200 shadow-sm text-slate-800'
            : 'apple-glass-dark border-white/10 shadow-2xl text-white'
        }`}>
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-[#0071E3] to-[#42A5F5] p-0.5 shadow-sm flex items-center justify-center shrink-0">
              <div className="h-full w-full bg-white/20 rounded-[10px] flex items-center justify-center">
                <HeartPulse className="h-5 w-5 text-white" />
              </div>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] tracking-wider uppercase font-semibold text-[#0071E3] bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
                  Kiosk & Secretariaat
                </span>
              </div>
              <h1 className={`text-sm sm:text-base font-bold tracking-tight flex items-center gap-2 ${
                viewMode === 'kiosk' ? 'text-slate-900' : 'text-white'
              }`}>
                Huidcentrum Gent <span className={`${viewMode === 'kiosk' ? 'text-slate-400' : 'text-white/40'} font-normal text-xs`}>| Aanmeldsysteem</span>
              </h1>
            </div>
          </div>

          {/* View Mode toggles */}
          <div className={`p-1 rounded-xl flex items-center gap-1 shadow-xs border ${
            viewMode === 'kiosk' 
              ? 'bg-slate-100/90 border-slate-200 text-slate-600' 
              : 'bg-black/40 border-white/10 text-white backdrop-blur-xl'
          }`}>
            <button
              id="view-toggle-kiosk"
              onClick={() => handleRequestViewChange('kiosk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'kiosk' 
                  ? 'bg-[#0071E3] text-white shadow-sm' 
                  : 'hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Tablet className="h-3.5 w-3.5" />
              <span>Kiosk (Volledig Scherm)</span>
              {systemConfig.kioskLocked && (
                <Lock className="h-3 w-3 text-amber-300 ml-0.5" />
              )}
            </button>

            <button
              id="view-toggle-split"
              onClick={() => handleRequestViewChange('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'split' 
                  ? 'bg-[#0071E3] text-white shadow-sm' 
                  : 'hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Dual-View
            </button>
            
            <button
              id="view-toggle-admin"
              onClick={() => handleRequestViewChange('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 cursor-pointer ${
                viewMode === 'admin' 
                  ? 'bg-[#0071E3] text-white shadow-sm' 
                  : 'hover:text-slate-900 hover:bg-white/40'
              }`}
            >
              <Monitor className="h-3.5 w-3.5" />
              <span>Secretariaat Admin</span>
              {systemConfig.kioskLocked && (
                <span className="text-[10px] px-1 py-0.2 rounded bg-amber-400/20 text-amber-600 font-mono">PIN</span>
              )}
            </button>
          </div>

          {/* Diagnostic Actions */}
          <div className="flex gap-2 items-center">
            <button
              onClick={handleResetEntireData}
              title="Reset alle gegevens naar standaard"
              className={`px-3 py-1.5 border rounded-lg transition duration-200 cursor-pointer text-xs flex items-center gap-1.5 ${
                viewMode === 'kiosk'
                  ? 'bg-white hover:bg-red-50 text-slate-600 hover:text-red-600 border-slate-200'
                  : 'bg-white/5 hover:bg-white/10 border-white/10 text-white/70 hover:text-red-400'
              }`}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Data
            </button>
          </div>
        </header>
      )}

      {/* CORE WORKSPACE CONTENT PANEL */}
      <main className={`relative z-10 flex-1 w-full flex flex-col justify-center ${
        viewMode === 'kiosk' 
          ? 'p-0 m-0 max-w-none h-full' 
          : 'p-4 md:p-6 max-w-[1550px] mx-auto'
      }`}>
        
        {/* VIEW 1: DUAL-VIEW SPLIT LIVE SYNC SIMULATION */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-stretch w-full">
            
            {/* LEFT 5 COLUMNS: THE TABLET KIOSK (CLEAN BORDERLESS VIEW) */}
            <div className="md:col-span-5 flex flex-col justify-center items-center">
              
              {/* Device Header label */}
              <div className="text-center font-mono text-[11px] text-sky-400/80 mb-2.5 flex items-center gap-2 tracking-wide font-medium">
                <Tablet className="h-4 w-4 text-sky-400" />
                WACHTKAMER TABLET (PATIËNTEN INTERFACE)
              </div>

              {/* Patient terminal component wrapper without dark tablet bezel */}
              <div className="w-full bg-[#f6f8fb] rounded-2xl overflow-hidden shadow-xl border border-slate-200">
                <KioskApp 
                  doctors={doctors}
                  onPatientRegister={handlePatientRegister}
                  onTeamsNotify={handleTeamsNotify}
                  isKioskLocked={systemConfig.kioskLocked ?? false}
                  onRequestStaffUnlock={handleKioskStaffUnlock}
                  onToggleFullscreen={handleToggleFullscreen}
                  isFullscreen={isFullscreen}
                />
              </div>

              <div className="mt-4 text-center max-w-sm">
                <p className="text-white/40 text-xs">
                  💡 <strong>Live Synchronisatie:</strong> Registreer links een patiënt en zie deze direct rechts realtime verschijnen in het secretariaatsportaal.
                </p>
              </div>
            </div>

            {/* RIGHT 7 COLUMNS: ENTIRE WEB-BASED ADMINISTRATION PANEL */}
            <div className="md:col-span-7 flex flex-col justify-stretch overflow-hidden">
              {/* Web Browser indicator */}
              <div className="text-center md:text-left font-mono text-[11px] text-sky-400/80 mb-2.5 flex items-center justify-center md:justify-start gap-2 tracking-wide font-medium">
                <Monitor className="h-4 w-4" />
                SECRETARIAAT BROWSER (ARTSEN & BALIE)
              </div>

              <div className="flex-1 apple-glass rounded-3xl shadow-2xl overflow-hidden border border-white/20">
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
                />
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: FULLSCREEN TABLET TERMINAL (EDGE-TO-EDGE) */}
        {viewMode === 'kiosk' && (
          <div className="w-full flex-1 flex flex-col items-stretch h-full">
            <KioskApp 
              doctors={doctors}
              onPatientRegister={handlePatientRegister}
              onTeamsNotify={handleTeamsNotify}
              isKioskLocked={systemConfig.kioskLocked ?? false}
              onRequestStaffUnlock={handleKioskStaffUnlock}
              onToggleFullscreen={handleToggleFullscreen}
              isFullscreen={isFullscreen}
            />
          </div>
        )}

        {/* VIEW 3: FULLSCREEN WEB RECEPTION SYSTEM */}
        {viewMode === 'admin' && (
          <div className="w-full max-w-6xl mx-auto py-2">
            <div className="apple-glass rounded-3xl shadow-2xl overflow-hidden border border-white/20">
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
              />
            </div>
          </div>
        )}

      </main>

      {/* FOOTER INFORMATIONAL CREDITS (Only visible in admin or split mode) */}
      {viewMode !== 'kiosk' && (
        <footer className="relative z-10 apple-glass-dark border-t border-white/10 py-3.5 px-6 text-center text-[11px] text-white/40 shrink-0">
          <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
            <span>&copy; 2026 Huidcentrum Gent &bull; Apple Glass Medical Edition</span>
            <div className="flex gap-4">
              <span className="flex items-center gap-1.5 text-emerald-400/90 font-medium">
                <ClipboardList className="h-3.5 w-3.5" />
                100% AVG / GDPR Conform
              </span>
              <span className="flex items-center gap-1.5 text-sky-400/90 font-medium">
                <ShieldAlert className="h-3.5 w-3.5" />
                Versleutelde Database
              </span>
            </div>
          </div>
        </footer>
      )}

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
