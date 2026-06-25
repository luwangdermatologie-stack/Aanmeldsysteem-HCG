/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification } from './types';
import KioskApp from './components/KioskApp';
import AdminDashboard from './components/AdminDashboard';
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
  HeartPulse
} from 'lucide-react';
import { db, initializeDatabaseIfEmpty, handleFirestoreError, OperationType, sanitizeForFirestore } from './firebase';
import { collection, doc, setDoc, updateDoc, deleteDoc, onSnapshot, writeBatch } from 'firebase/firestore';

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
    const saved = localStorage.getItem('derm_reception_viewmode');
    if (saved === 'kiosk' || saved === 'admin' || saved === 'split') {
      return saved;
    }
    return 'admin';
  });

  const [isLocked] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('lock') === 'true' || params.get('hideHeader') === 'true';
  });

  // Persist viewMode
  useEffect(() => {
    localStorage.setItem('derm_reception_viewmode', viewMode);
  }, [viewMode]);
  
  // State synchronized with Firebase Firestore
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [staff, setStaff] = useState<ActiveStaff[]>([]);
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
    const resolvedRoom = doctor ? doctor.waitingRoom : 'Gelijkvloers';

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
  const handleTeamsNotify = async (messageText: string, target?: string, payload?: any) => {
    const now = new Date();
    const timeStr = now.toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    
    const newLogItem: TeamsNotification = {
      id: `notif-${Date.now()}`,
      timestamp: timeStr,
      targetDoctor: target,
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
            title: "Huidcentrum Gent - Kiosk Aanmelding",
            payload
          })
        });
        
        if (response.ok) {
          newLogItem.status = 'Success';
        } else {
          newLogItem.status = 'Failed';
          console.error("Teams proxy dispatch returned error status");
        }
      } catch (err) {
        newLogItem.status = 'Failed';
        console.error("Teams webhook dispatch failed due to networking. Logged as failed.", err);
      }
    }

    try {
      await setDoc(doc(db, 'notifications', newLogItem.id), sanitizeForFirestore(newLogItem));
    } catch (err) {
      console.error("Error adding notification to firestore:", err);
    }
  };

  // Consistent system configuration updates (sync with Firestore and local State)
  const handleUpdateConfig = async (conf: Partial<SystemConfig>) => {
    try {
      setSystemConfig(prev => ({ ...prev, ...conf }));
      await setDoc(doc(db, 'config', 'system'), conf, { merge: true });
    } catch (err) {
      console.error("Error updating system config in firestore:", err);
    }
  };

  // Patient manual status transition from table
  const handleUpdatePatientStatus = async (patientId: string, newStatus: Patient['status']) => {
    try {
      if (newStatus === 'Archived') {
        await deleteDoc(doc(db, 'patients', patientId));
      } else {
        await updateDoc(doc(db, 'patients', patientId), { status: newStatus });
      }
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
            batch.delete(doc(db, 'patients', p.id));
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

      await setDoc(doc(db, 'config', 'system'), {
        currentDagdeel: options.nextPeriod,
        activeStaffId: options.supportStaffId
      }, { merge: true });
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
        
        // Remove the initialized flag so the initializer can run again
        batch.delete(doc(db, 'config', 'initialized'));
        
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

  if (viewMode === 'kiosk') {
    return (
      <div className="min-h-screen bg-[#FAF6F0] relative overflow-hidden w-screen h-screen" id="kiosk-fullscreen-root">
        <KioskApp 
          doctors={doctors}
          onPatientRegister={handlePatientRegister}
          onTeamsNotify={handleTeamsNotify}
          isFullscreen={true}
        />
      </div>
    );
  }

  if (viewMode === 'admin') {
    return (
      <div className="min-h-screen bg-slate-50 p-4 md:p-6" id="admin-fullscreen-root">
        <div className="max-w-7xl mx-auto w-full bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
          <AdminDashboard 
            patients={patients}
            doctors={doctors}
            activeStaffList={staff}
            systemConfig={systemConfig}
            notifications={notifications}
            onUpdateConfig={handleUpdateConfig}
            onUpdateDoctors={handleUpdateDoctors}
            onUpdateStaff={handleUpdateStaff}
            onUpdatePatientStatus={handleUpdatePatientStatus}
            onResetDagdeel={handleResetDagdeel}
            onClearNotificationLog={handleClearNotifications}
            onAddSimulatedPatient={handleAddRandomSimulatedPatient}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 font-sans flex flex-col justify-between" id="applet-root">
      
      {/* GLOBAL SIMULATION BAR - TOP HEADER */}
      {!isLocked && (
        <header className="bg-slate-950 border-b border-slate-800 px-6 py-3 flex flex-col md:flex-row justify-between items-center gap-3">
          <div className="flex items-center gap-3">
            <div className="bg-[#FAF6F0] p-1.5 rounded-xl border border-[#EDDFD0] shadow-sm shrink-0">
              <HeartPulse className="h-6 w-6 text-[#D98C82]" />
            </div>
            <div>
              <span className="text-xs uppercase tracking-wider font-mono text-indigo-400 font-bold">Concept Demonstration &bull; UX/UI</span>
              <h1 className="text-base sm:text-lg font-serif font-bold text-white tracking-tight flex items-center gap-2">
                Dermatologie Digitaal Ontvangstsysteem
              </h1>
            </div>
          </div>

          {/* View Mode toggles */}
          <div className="bg-slate-900 border border-slate-800 p-1 rounded-xl flex items-center gap-1">
            <button
              id="view-toggle-split"
              onClick={() => setViewMode('split')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'split' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <LayoutGrid className="h-3.5 w-3.5" />
              Dual-View Simulator
            </button>
            
            <button
              id="view-toggle-kiosk"
              onClick={() => setViewMode('kiosk')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'kiosk' ? 'bg-[#D98C82] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Tablet className="h-3.5 w-3.5" />
              Alleen Kiosk (Patiënt)
            </button>

            <button
              id="view-toggle-admin"
              onClick={() => setViewMode('admin')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${viewMode === 'admin' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'}`}
            >
              <Monitor className="h-3.5 w-3.5" />
              Alleen Admin (Arts/Balie)
            </button>
          </div>

          {/* Diagnostic Actions */}
          <div className="flex gap-2">
            <button
              onClick={handleResetEntireData}
              title="Reset alle gegevens naar standaard"
              className="p-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 hover:border-slate-700 text-slate-400 hover:text-red-400 rounded-xl transition cursor-pointer text-xs flex items-center gap-1"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset Data
            </button>
          </div>
        </header>
      )}

      {/* CORE WORKSPACE CONTENT PANEL */}
      <main className="flex-1 p-4 md:p-6 max-w-[1550px] mx-auto w-full flex flex-col justify-center">
        
        {/* VIEW 1: DUAL-VIEW SPLIT LIVE SYNC SIMULATION */}
        {viewMode === 'split' && (
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-stretch w-full">
            
            {/* LEFT 5 COLUMNS: THE TABLET KIOSK WRAPPED IN BEAUTIFUL IPAD HARDWARE MOCKUP */}
            <div className="xl:col-span-12 xl:col-span-5 flex flex-col justify-center items-center">
              
              {/* Device Header label */}
              <div className="text-center font-mono text-[11px] text-slate-400 mb-2.5 flex items-center gap-2">
                <Tablet className="h-4.5 w-4.5 text-[#D98C82]" />
                LOKALE TABLET (Huidcentrum Gent &bull; RECEPTIE KIOSK)
              </div>

              {/* Landscape IPad hardware framing shell */}
              <div className="relative w-full max-w-[620px] bg-slate-950 p-4 sm:p-5 rounded-[28px] border-[5px] border-slate-800 shadow-2xl flex flex-col justify-center">
                
                {/* Screen top camera lens cutout */}
                <span className="absolute left-1/2 -translate-x-1/2 top-2 h-2 w-2 rounded-full bg-slate-900 border border-slate-800"></span>

                {/* Patient terminal component wrapper */}
                <div className="w-full bg-[#FAF6F0] rounded-xl overflow-hidden border border-slate-900">
                  <KioskApp 
                    doctors={doctors}
                    onPatientRegister={handlePatientRegister}
                    onTeamsNotify={handleTeamsNotify}
                  />
                </div>

                {/* Device bottom software bar */}
                <div className="mt-3.5 flex justify-center items-center h-1 bg-slate-800 w-28 rounded-full mx-auto"></div>
              </div>

              <div className="mt-4 text-center max-w-sm">
                <p className="text-slate-400 text-xs">
                  💡 <strong>Interactiviteitstip:</strong> Registreer links een patiënt en zie deze <strong>realtime</strong> rechts verschijnen in de tabel van de arts!
                </p>
              </div>
            </div>

            {/* RIGHT 7 COLUMNS: ENTIRE WEB-BASED ADMINISTRATION PANEL */}
            <div className="xl:col-span-12 xl:col-span-7 flex flex-col justify-stretch">
              {/* Web Browser indicator */}
              <div className="text-center xl:text-left font-mono text-[11px] text-indigo-400 mb-2.5 flex items-center justify-center xl:justify-start gap-2">
                <Monitor className="h-4.5 w-4.5" />
                SECRETARIAAT BROWSER (DERMATOLOGO-ADMIN SERVICES)
              </div>

              <div className="flex-1 bg-white rounded-2xl shadow-xl overflow-hidden border border-slate-200">
                <AdminDashboard 
                  patients={patients}
                  doctors={doctors}
                  activeStaffList={staff}
                  systemConfig={systemConfig}
                  notifications={notifications}
                  onUpdateConfig={handleUpdateConfig}
                  onUpdateDoctors={handleUpdateDoctors}
                  onUpdateStaff={handleUpdateStaff}
                  onUpdatePatientStatus={handleUpdatePatientStatus}
                  onResetDagdeel={handleResetDagdeel}
                  onClearNotificationLog={handleClearNotifications}
                  onAddSimulatedPatient={handleAddRandomSimulatedPatient}
                />
              </div>
            </div>

          </div>
        )}

        {/* VIEW 2: FULLSCREEN TABLET TERMINAL */}
        {viewMode === 'kiosk' && (
          <div className="max-w-[760px] mx-auto w-full py-4 flex flex-col items-center">
            <div className="text-center font-serif text-sm text-slate-400 mb-3.5 flex items-center gap-1.5">
              <Tablet className="h-4.5 w-4.5 text-[#D98C82] animate-pulse" />
              UITVERGROTE TABLET WEERGAVE &bull; LANDSCAPE
            </div>

            <div className="w-full bg-slate-950 p-6 rounded-[32px] border-[6px] border-slate-800 shadow-2xl">
              <div className="bg-[#FAF6F0] rounded-xl overflow-hidden border border-slate-900">
                <KioskApp 
                  doctors={doctors}
                  onPatientRegister={handlePatientRegister}
                  onTeamsNotify={handleTeamsNotify}
                />
              </div>
            </div>
            
            <p className="text-xs text-slate-400 mt-4 text-center max-w-md">
              Dit is het ware scherm dat patiënten in de wachtkamer zien op de fysiek geplaatste tablet. Verander rechtsonder de taal om het direct in het NL, EN, FR, TR of AR te bekijken!
            </p>
          </div>
        )}

        {/* VIEW 3: FULLSCREEN WEB RECEPTION SYSTEM */}
        {viewMode === 'admin' && (
          <div className="w-full max-w-6xl mx-auto py-2">
            <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-300">
              <AdminDashboard 
                patients={patients}
                doctors={doctors}
                activeStaffList={staff}
                systemConfig={systemConfig}
                notifications={notifications}
                onUpdateConfig={handleUpdateConfig}
                onUpdateDoctors={handleUpdateDoctors}
                onUpdateStaff={handleUpdateStaff}
                onUpdatePatientStatus={handleUpdatePatientStatus}
                onResetDagdeel={handleResetDagdeel}
                onClearNotificationLog={handleClearNotifications}
                onAddSimulatedPatient={handleAddRandomSimulatedPatient}
              />
            </div>
          </div>
        )}

      </main>

      {/* FOOTER INFORMATIONAL CREDITS */}
      <footer className="bg-slate-950 border-t border-slate-800 py-3.5 px-6 text-center text-[11px] text-slate-500 shrink-0">
        <div className="max-w-4xl mx-auto flex flex-col md:flex-row justify-between items-center gap-2">
          <span>&copy; 2026 DermatoMed &bull; Privacy-first Reception Suite</span>
          <div className="flex gap-4">
            <span className="flex items-center gap-1">
              <ClipboardList className="h-3 w-3 text-indigo-400" />
              100% GDPR Conform
            </span>
            <span className="flex items-center gap-1">
              <ShieldAlert className="h-3 w-3 text-amber-500" />
              Patiënten-Database Versleuteld (AES-256)
            </span>
          </div>
        </div>
      </footer>
    </div>
  );
}
