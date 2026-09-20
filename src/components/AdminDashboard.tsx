/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification, Timesheet } from '../types';
import GoogleSheetsBackupSection from './GoogleSheetsBackupSection';
import { LeavePlanningModule } from './leave/LeavePlanningModule';
import { TeamsChatAndLogModule } from './TeamsChatAndLogModule';
import { syncStaffBetweenConfigAndLeave } from '../services/leaveService';
import { getDetectedEnvironment, setEnvironmentOverride, isTestEnvironment, AppEnvironment } from '../config/environment';
import { cloneProductionStaffToTest, resetTestDatabase } from '../firebase';
import { 
  Users, 
  Settings, 
  SlidersHorizontal, 
  UserCheck, 
  Trash2, 
  FileLock2, 
  BellRing, 
  ExternalLink,
  MapPin, 
  Clock, 
  Hourglass, 
  TrendingUp, 
  HelpCircle,
  FolderSync,
  CheckCircle,
  CalendarDays,
  CalendarRange,
  Plus,
  Pencil,
  Lock,
  ShieldCheck,
  ShieldAlert,
  Eye,
  EyeOff,
  RefreshCw,
  Tablet,
  Database,
  Copy,
  Sparkles
} from 'lucide-react';

interface AdminDashboardProps {
  patients: Patient[];
  doctors: Doctor[];
  activeStaffList: ActiveStaff[];
  timesheets: Timesheet[];
  systemConfig: SystemConfig;
  notifications: TeamsNotification[];
  onUpdateConfig: (config: Partial<SystemConfig>) => void;
  onUpdateDoctors: (doctors: Doctor[]) => void;
  onUpdateStaff: (staff: ActiveStaff[]) => void;
  onUpdatePatientStatus: (patientId: string, status: Patient['status']) => void;
  onResetDagdeel: (options: { clearPatients: boolean; reassignRooms: Record<string, 'Gelijkvloers' | 'Bovenverdieping'>; supportStaffId: string; nextPeriod: 'ochtend' | 'middag' }) => void;
  onClearNotificationLog: () => void;
  onAddSimulatedPatient: () => void;
  onUpdateTimesheet: (timesheet: Timesheet) => void;
  onDeleteTimesheet: (id: string) => void;
  onLockAdmin?: () => void;
  onRunGdprAnonymize?: () => Promise<{ processed: number; anonymized: number }>;
  onTeamsNotify?: (messageText: string, target?: string, payload?: any) => Promise<boolean>;
  onSwitchView?: (view: 'kiosk' | 'split' | 'admin') => void;
  onSyncStaff?: () => Promise<any>;
  onRestoreTimesheets?: (restored: Timesheet[]) => Promise<void>;
}

export default function AdminDashboard({
  patients,
  doctors,
  activeStaffList,
  timesheets,
  systemConfig,
  notifications,
  onUpdateConfig,
  onUpdateDoctors,
  onUpdateStaff,
  onUpdatePatientStatus,
  onResetDagdeel,
  onClearNotificationLog,
  onAddSimulatedPatient,
  onUpdateTimesheet,
  onDeleteTimesheet,
  onLockAdmin,
  onRunGdprAnonymize,
  onTeamsNotify,
  onSwitchView,
  onSyncStaff,
  onRestoreTimesheets
}: AdminDashboardProps) {
  // Tabs and filters inside Admin
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'timesheets' | 'leave'>('overview');
  const [searchTerm, setSearchTerm] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('all');
  const [roomFilter, setRoomFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'arrivalTime' | 'appointmentTime'>('arrivalTime');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [gdprMaskActive, setGdprMaskActive] = useState(false); // Default to false (no mask) as requested

  // Managing Doctors and Staff form/edit states
  const [newDocName, setNewDocName] = useState('');
  const [newDocSpecialty, setNewDocSpecialty] = useState('');
  const [newDocRoom, setNewDocRoom] = useState<'Gelijkvloers' | 'Bovenverdieping'>('Gelijkvloers');
  const [newDocWebhook, setNewDocWebhook] = useState('');

  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('');

  const [editingDocId, setEditingDocId] = useState<string | null>(null);
  const [editingDocName, setEditingDocName] = useState('');
  const [editingDocSpecialty, setEditingDocSpecialty] = useState('');
  const [editingDocWebhook, setEditingDocWebhook] = useState('');

  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingStaffName, setEditingStaffName] = useState('');
  const [editingStaffRole, setEditingStaffRole] = useState('');

  // Configuration Setup temporary states
  const [tempPeriod, setTempPeriod] = useState<'ochtend' | 'middag'>(systemConfig.currentDagdeel);
  const [tempStaffId, setTempStaffId] = useState(systemConfig.activeStaffId);
  const [tempWebhook, setTempWebhook] = useState(systemConfig.teamsWebhookUrl);
  const [tempDoctorRooms, setTempDoctorRooms] = useState<Record<string, 'Gelijkvloers' | 'Bovenverdieping'>>(
    doctors.reduce((acc, dr) => ({ ...acc, [dr.id]: dr.waitingRoom }), {})
  );

  // Timesheets management - Default to showing all timesheets so manual entries are never hidden
  const [selectedTsMonth, setSelectedTsMonth] = useState<string>('');
  const [selectedTsStaff, setSelectedTsStaff] = useState<string>('all');
  const [isEditingTs, setIsEditingTs] = useState(false);
  const [editingTsId, setEditingTsId] = useState<string>('');
  const [editingTsStaff, setEditingTsStaff] = useState<string>('');
  const [editingTsDate, setEditingTsDate] = useState<string>('');
  const [editingTsIn, setEditingTsIn] = useState<string>('');
  const [editingTsOut, setEditingTsOut] = useState<string>('');

  // Security PIN and GDPR state
  const [tempPin, setTempPin] = useState(systemConfig.adminPin || '1234');
  const [showPinMask, setShowPinMask] = useState(true);
  const [tempGdprAuto, setTempGdprAuto] = useState(systemConfig.gdprAutoAnonymize ?? true);
  const [tempRetentionHours, setTempRetentionHours] = useState(systemConfig.gdprRetentionHours || 24);
  const [isGdprRunning, setIsGdprRunning] = useState(false);

  React.useEffect(() => {
    if (systemConfig.adminPin) setTempPin(systemConfig.adminPin);
    if (systemConfig.gdprAutoAnonymize !== undefined) setTempGdprAuto(systemConfig.gdprAutoAnonymize);
    if (systemConfig.gdprRetentionHours) setTempRetentionHours(systemConfig.gdprRetentionHours);
  }, [systemConfig.adminPin, systemConfig.gdprAutoAnonymize, systemConfig.gdprRetentionHours]);

  const handleTriggerGdpr = async () => {
    if (!onRunGdprAnonymize) return;
    setIsGdprRunning(true);
    try {
      const res = await onRunGdprAnonymize();
      showToast(`🛡️ GDPR Opschoning voltooid: ${res.anonymized} dossiers geanonimiseerd (van ${res.processed} geanalyseerd).`, "success");
    } catch (err: any) {
      showToast("Fout bij uitvoeren van GDPR opschoning: " + (err?.message || 'Onbekende fout'), "warning");
    } finally {
      setIsGdprRunning(false);
    }
  };

  // Environment state & management
  const [currentEnv, setCurrentEnv] = useState<AppEnvironment>(getDetectedEnvironment());
  const [isCloningData, setIsCloningData] = useState(false);
  const [isResettingTestData, setIsResettingTestData] = useState(false);

  // Environment Switch PIN Modal State (Developer protection)
  const [isEnvModalOpen, setIsEnvModalOpen] = useState(false);
  const [envPinInput, setEnvPinInput] = useState('');
  const [showEnvPin, setShowEnvPin] = useState(false);
  const [envPinError, setEnvPinError] = useState<string | null>(null);

  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e.detail?.environment || getDetectedEnvironment();
      setCurrentEnv(newEnv);
    };
    window.addEventListener('hcg_environment_changed', handleEnvChange);
    return () => window.removeEventListener('hcg_environment_changed', handleEnvChange);
  }, []);

  const handleInitiateToggleEnvironment = () => {
    setEnvPinInput('');
    setEnvPinError(null);
    setShowEnvPin(false);
    setIsEnvModalOpen(true);
  };

  const handleConfirmToggleEnvironment = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const expectedPin = systemConfig.adminPin || '1234';
    if (envPinInput.trim() !== expectedPin) {
      setEnvPinError('Onjuiste pincode. Voer de geldige beheerder/developer-PIN in.');
      return;
    }
    const nextEnv: AppEnvironment = currentEnv === 'test' ? 'production' : 'test';
    setEnvironmentOverride(nextEnv);
    setCurrentEnv(nextEnv);
    setIsEnvModalOpen(false);
    setEnvPinInput('');
    setEnvPinError(null);
    showToast(`Omschakeling naar ${nextEnv === 'test' ? 'Testomgeving (AI Studio)' : 'Productie-omgeving (GitHub)'}`, "info");
  };

  const handleCloneStaffToTest = async () => {
    if (!confirm("Weet u zeker dat u de actieve artsen en balie-medewerkers uit de productie-omgeving wilt kopiëren naar de testomgeving? Bestaande test-artsen worden bijgewerkt.")) return;
    setIsCloningData(true);
    try {
      const res = await cloneProductionStaffToTest();
      showToast(`Succesvol ${res.doctorsCount} artsen en ${res.staffCount} medewerkers naar de testomgeving gekopieerd!`, "success");
    } catch (err: any) {
      showToast("Fout bij kopiëren van personeel naar testomgeving: " + (err?.message || 'Onbekende fout'), "warning");
    } finally {
      setIsCloningData(false);
    }
  };

  const handleResetTestData = async () => {
    if (!confirm("🚨 Pas op: dit zal ALLE testgegevens in de testomgeving (patiënten, prikklok, verlofaanvragen, etc.) leegmaken. Dit heeft GEEN invloed op de productie op GitHub. Doorgaan?")) return;
    setIsResettingTestData(true);
    try {
      await resetTestDatabase();
      showToast("Testomgeving succesvol opgeschoond en opnieuw geïnitialiseerd.", "success");
    } catch (err: any) {
      showToast("Fout bij leegmaken van testdatabase: " + (err?.message || 'Onbekende fout'), "warning");
    } finally {
      setIsResettingTestData(false);
    }
  };

  const [testState, setTestState] = React.useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testError, setTestError] = React.useState('');

  const handleTestWebhook = async () => {
    if (!tempWebhook || !tempWebhook.startsWith('http')) {
      setTestState('failed');
      setTestError('Gelieve een geldige URL in te voeren die begint met http:// of https://');
      return;
    }

    setTestState('testing');
    setTestError('');

    try {
      const response = await fetch('/api/teams-notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          webhookUrl: tempWebhook,
          messageText: '🧪 **Verbindingstest Geslaagd!** De koppeling met de aanmeldkiosk van Huidcentrum Gent werkt nu perfect met uw Power Automate flow of Microsoft Teams kanaal.',
          title: 'Huidcentrum Gent - Kiosk Koppelingstest',
          payload: {
            "Meldingstype": "Systeemverbindingstest",
            "Status": "Koppeling live! ✅",
            "Tijdstip": new Date().toLocaleTimeString('nl-BE', { hour: '2-digit', minute: '2-digit' }),
            "Details": "Dit is een automatisch gegenereerde test om de webhook-respons en payloads te verifiëren."
          }
        })
      });

      const data = await response.json();
      if (response.ok && data.status === 'success') {
        setTestState('success');
      } else {
        setTestState('failed');
        setTestError(data.message || `Foutcode ${response.status} teruggestuurd door uw webhook API.`);
      }
    } catch (err: any) {
      setTestState('failed');
      setTestError(err?.message || 'Netwerkverbinding met de server of de webhook is mislukt.');
    }
  };

  // Custom non-blocking modals/toast message states
  const [toast, setToast] = useState<{ message: string; type: 'info' | 'success' | 'warning' } | null>(null);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [doctorToDelete, setDoctorToDelete] = useState<Doctor | null>(null);
  const [staffToDelete, setStaffToDelete] = useState<ActiveStaff | null>(null);

  const showToast = (message: string, type: 'info' | 'success' | 'warning' = 'info') => {
    setToast({ message, type });
    setTimeout(() => {
      setToast(null);
    }, 4500);
  };

  React.useEffect(() => {
    setTempPeriod(systemConfig.currentDagdeel);
    setTempStaffId(systemConfig.activeStaffId);
    setTempWebhook(systemConfig.teamsWebhookUrl || '');
  }, [systemConfig]);

  React.useEffect(() => {
    setTempDoctorRooms(
      doctors.reduce((acc, dr) => ({ ...acc, [dr.id]: dr.waitingRoom }), {})
    );
  }, [doctors]);

  // Doctors & Staff Management functions
  const handleAddDoctor = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDocName.trim() || !newDocSpecialty.trim()) return;
    const colors = ['bg-teal-500', 'bg-rose-500', 'bg-indigo-500', 'bg-amber-500', 'bg-violet-500', 'bg-sky-500', 'bg-emerald-500'];
    const randomColor = colors[Math.floor(Math.random() * colors.length)];
    const newDoc: Doctor = {
      id: `dr-${Date.now()}`,
      name: newDocName.trim(),
      specialty: newDocSpecialty.trim(),
      waitingRoom: newDocRoom,
      isAvailable: true,
      avatarColor: randomColor,
      teamsWebhookUrl: newDocWebhook.trim()
    };
    onUpdateDoctors([...doctors, newDoc]);
    setTempDoctorRooms(prev => ({ ...prev, [newDoc.id]: newDocRoom }));
    setNewDocName('');
    setNewDocSpecialty('');
    setNewDocWebhook('');
  };

  const confirmDeleteDoctor = (dr: Doctor) => {
    if (doctors.length <= 1) {
      showToast("Er moet minstens één arts actief blijven in het systeem.", "warning");
      return;
    }
    setDoctorToDelete(dr);
  };

  const handleExecuteDeleteDoctor = () => {
    if (!doctorToDelete) return;
    const updated = doctors.filter(dr => dr.id !== doctorToDelete.id);
    onUpdateDoctors(updated);
    showToast(`Dermatoloog ${doctorToDelete.name} is succesvol verwijderd uit het systeem.`, "success");
    setDoctorToDelete(null);
  };

  const handleDeleteDoctor = (id: string) => {
    // Left as fallback signature, but redirects to confirmDeleteDoctor
    const dr = doctors.find(d => d.id === id);
    if (dr) confirmDeleteDoctor(dr);
  };

  const startEditingDoc = (dr: Doctor) => {
    setEditingDocId(dr.id);
    setEditingDocName(dr.name);
    setEditingDocSpecialty(dr.specialty);
    setEditingDocWebhook(dr.teamsWebhookUrl || '');
  };

  const handleSaveDocEdit = (id: string) => {
    if (!editingDocName.trim() || !editingDocSpecialty.trim()) return;
    const updated = doctors.map(dr => {
      if (dr.id === id) {
        return { ...dr, name: editingDocName.trim(), specialty: editingDocSpecialty.trim(), teamsWebhookUrl: editingDocWebhook.trim() };
      }
      return dr;
    });
    onUpdateDoctors(updated);
    setEditingDocId(null);
  };

  const [isSyncingStaff, setIsSyncingStaff] = useState(false);

  const handleSyncStaff = async () => {
    setIsSyncingStaff(true);
    try {
      if (onSyncStaff) {
        await onSyncStaff();
      } else {
        await syncStaffBetweenConfigAndLeave(activeStaffList, doctors);
      }
      showToast("Personeel succesvol gesynchroniseerd met Verlofplanning!", "success");
    } catch (err) {
      console.error("Staff sync error:", err);
      showToast("Fout bij synchroniseren van personeel.", "warning");
    } finally {
      setIsSyncingStaff(false);
    }
  };

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffRole.trim()) return;
    const newSt: ActiveStaff = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole.trim()
    };
    const updated = [...activeStaffList, newSt];
    onUpdateStaff(updated);
    setNewStaffName('');
    setNewStaffRole('');
    syncStaffBetweenConfigAndLeave(updated, doctors).catch(err => console.warn(err));
    showToast(`Medewerker ${newSt.name} toegevoegd en gesynchroniseerd met verlofplanning.`, "success");
  };

  const confirmDeleteStaff = (st: ActiveStaff) => {
    if (activeStaffList.length <= 1) {
      showToast("Er moet minstens één balie-medewerker actief blijven.", "warning");
      return;
    }
    setStaffToDelete(st);
  };

  const handleExecuteDeleteStaff = () => {
    if (!staffToDelete) return;
    const updated = activeStaffList.filter(st => st.id !== staffToDelete.id);
    onUpdateStaff(updated);
    if (tempStaffId === staffToDelete.id && updated.length > 0) {
      setTempStaffId(updated[0].id);
    }
    syncStaffBetweenConfigAndLeave(updated, doctors).catch(err => console.warn(err));
    showToast(`Medewerker ${staffToDelete.name} is succesvol verwijderd uit het personeelsbestand en verlofplanning.`, "success");
    setStaffToDelete(null);
  };

  const handleDeleteStaff = (id: string) => {
    // Left as fallback signature, but redirects to confirmDeleteStaff
    const st = activeStaffList.find(s => s.id === id);
    if (st) confirmDeleteStaff(st);
  };

  const startEditingStaff = (st: ActiveStaff) => {
    setEditingStaffId(st.id);
    setEditingStaffName(st.name);
    setEditingStaffRole(st.role);
  };

  const handleSaveStaffEdit = (id: string) => {
    if (!editingStaffName.trim() || !editingStaffRole.trim()) return;
    const updated = activeStaffList.map(st => {
      if (st.id === id) {
        return { ...st, name: editingStaffName.trim(), role: editingStaffRole.trim() };
      }
      return st;
    });
    onUpdateStaff(updated);
    setEditingStaffId(null);
    syncStaffBetweenConfigAndLeave(updated, doctors).catch(err => console.warn(err));
    showToast(`Gegevens bijgewerkt en gesynchroniseerd met verlofplanning.`, "success");
  };

  // Stats calculation
  const totalInDagdeel = patients.filter(p => p.status !== 'Archived').length;
  const waitingCount = patients.filter(p => p.status === 'Waiting').length;
  const calledCount = patients.filter(p => p.status === 'Called').length;
  const doneCount = patients.filter(p => p.status === 'Done').length;
  const lateCheckins = patients.filter(p => {
    if (!p.appointmentTime) return false;
    // Check if patient joined time exceeded appointment
    return p.hasAppointment && p.status !== 'Archived'; // simplifies
  }).length; // illustrative counting

  const handleDoctorRoomChange = (drId: string, room: 'Gelijkvloers' | 'Bovenverdieping') => {
    setTempDoctorRooms(prev => ({
      ...prev,
      [drId]: room
    }));
  };

  const handleApplyConfig = (e: React.FormEvent) => {
    e.preventDefault();
    onUpdateConfig({
      currentDagdeel: tempPeriod,
      activeStaffId: tempStaffId,
      teamsWebhookUrl: tempWebhook,
      adminPin: tempPin,
      gdprAutoAnonymize: tempGdprAuto,
      gdprRetentionHours: Number(tempRetentionHours)
    });

    // Save doctor assignments
    const updatedDoctors = doctors.map(dr => ({
      ...dr,
      waitingRoom: tempDoctorRooms[dr.id] || dr.waitingRoom
    }));
    onUpdateDoctors(updatedDoctors);

    showToast("⚙️ Configuratie & beveiligingsinstellingen succesvol opgeslagen!", "success");
  };

  const runDagdeelReset = () => {
    setShowResetConfirm(true);
  };

  const handleExecuteDagdeelReset = () => {
    onResetDagdeel({
      clearPatients: true,
      reassignRooms: tempDoctorRooms,
      supportStaffId: tempStaffId,
      nextPeriod: tempPeriod
    });
    setShowResetConfirm(false);
    showToast(`🔄 Systeem succesvol gereset voor het dagdeel: ${tempPeriod.toUpperCase()}`, "success");
  };

  // Filter & Sort patients list
  const filteredPatients = patients
    .filter(p => p.status !== 'Archived')
    .filter(p => {
      const searchLower = searchTerm.toLowerCase();
      const cleanSearchDigits = searchTerm.replace(/\D/g, '');
      const patientRegClean = (p.nationalRegistryNum || '').replace(/\D/g, '');
      const patientIdClean = (p.idCardNum || '').replace(/\D/g, '');

      const matchSearch = 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchLower) || 
        (p.nationalRegistryNum && p.nationalRegistryNum.includes(searchTerm)) ||
        (cleanSearchDigits && patientRegClean.includes(cleanSearchDigits)) ||
        (p.idCardNum && p.idCardNum.includes(searchTerm)) ||
        (cleanSearchDigits && patientIdClean.includes(cleanSearchDigits));
      const matchDoc = doctorFilter === 'all' || p.doctorId === doctorFilter;
      const matchRoom = roomFilter === 'all' || p.waitingRoom === roomFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      
      return matchSearch && matchDoc && matchRoom && matchStatus;
    })
    .sort((a, b) => {
      let valA = '';
      let valB = '';
      
      if (sortBy === 'arrivalTime') {
        valA = a.arrivalTime || '';
        valB = b.arrivalTime || '';
      } else {
        valA = a.appointmentTime || '99:99';
        valB = b.appointmentTime || '99:99';
      }

      if (sortOrder === 'asc') {
        return valA.localeCompare(valB);
      } else {
        return valB.localeCompare(valA);
      }
    });

  const toggleSort = (field: 'arrivalTime' | 'appointmentTime') => {
    if (sortBy === field) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  };

  const activeStaffName = activeStaffList.find(s => s.id === systemConfig.activeStaffId)?.name || 'Geen medewerker';

  // Timesheets logic
  const handleSaveTimesheet = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingTsStaff || !editingTsDate || !editingTsIn) {
      showToast("Vul minstens medewerker, datum en intiktijd in.", "warning");
      return;
    }
    const staffMember = activeStaffList.find(s => s.id === editingTsStaff);
    if (!staffMember) return;
    
    // Check if clockOut is valid
    if (editingTsOut && editingTsOut < editingTsIn) {
      showToast("Uittiktijd moet na intiktijd zijn.", "warning");
      return;
    }

    onUpdateTimesheet({
      id: editingTsId || `ts-${Date.now()}`,
      staffId: editingTsStaff,
      staffName: staffMember.name,
      clockIn: new Date(`${editingTsDate}T${editingTsIn}`).toISOString(),
      clockOut: editingTsOut ? new Date(`${editingTsDate}T${editingTsOut}`).toISOString() : null,
      date: editingTsDate
    });
    setIsEditingTs(false);
    showToast("Tiktijd succesvol opgeslagen.", "success");
  };

  const handleStartEditTs = (ts?: Timesheet) => {
    if (ts) {
      setEditingTsId(ts.id);
      setEditingTsStaff(ts.staffId);
      setEditingTsDate(ts.date);
      const inDate = new Date(ts.clockIn);
      setEditingTsIn(inDate.toTimeString().slice(0, 5));
      if (ts.clockOut) {
        const outDate = new Date(ts.clockOut);
        setEditingTsOut(outDate.toTimeString().slice(0, 5));
      } else {
        setEditingTsOut('');
      }
    } else {
      setEditingTsId('');
      setEditingTsStaff(activeStaffList[0]?.id || '');
      setEditingTsDate(new Date().toISOString().slice(0, 10));
      setEditingTsIn(new Date().toTimeString().slice(0, 5));
      setEditingTsOut('');
    }
    setIsEditingTs(true);
  };

  const handleClockAction = (staffId: string, isClockIn: boolean) => {
    const staffMember = activeStaffList.find(s => s.id === staffId);
    if (!staffMember) return;

    const now = new Date();
    const dateStr = now.toISOString().slice(0, 10);

    if (isClockIn) {
      onUpdateTimesheet({
        id: `ts-${Date.now()}`,
        staffId,
        staffName: staffMember.name,
        clockIn: now.toISOString(),
        clockOut: null,
        date: dateStr
      });
      showToast(`${staffMember.name} is succesvol ingeklokt.`, "success");
    } else {
      // Find open timesheet for this staff member today
      const openTs = timesheets.find(ts => ts.staffId === staffId && ts.date === dateStr && !ts.clockOut);
      if (openTs) {
        onUpdateTimesheet({
          ...openTs,
          clockOut: now.toISOString()
        });
        showToast(`${staffMember.name} is succesvol uitgeklokt.`, "success");
      } else {
        showToast(`Geen openstaande intik gevonden voor ${staffMember.name} vandaag.`, "warning");
      }
    }
  };

  // Helper to format Rijksregisternummer for live overview: without dots and dashes (only full continuous digits)
  const formatRegistryNum = (num: string): string => {
    if (!num || num === '-') return '-';
    // Remove all dots, hyphens, and whitespace: display only the clean complete number
    const cleanNum = num.replace(/[.\-\s]/g, '');
    if (!gdprMaskActive) return cleanNum;
    if (cleanNum.length < 6) return cleanNum;
    return cleanNum.replace(/\d/g, (char, index) => {
      if (index < 2 || index >= cleanNum.length - 2) return char;
      return '*';
    });
  };

  const formatBirthDate = (date: string): string => {
    if (!gdprMaskActive) return date;
    if (date === '-' || date.length < 5) return date;
    // e.g. 14/08/1985 to **/**/1985
    const parts = date.split('/');
    if (parts.length === 3) {
      return `**/**/${parts[2]}`;
    }
    return '**.**.****';
  };

  const handleSendTeamsChatMessage = async (messageText: string, target?: string, payload?: any): Promise<boolean> => {
    if (onTeamsNotify) {
      return await onTeamsNotify(messageText, target, payload);
    }
    try {
      const targetWebhook = systemConfig.teamsWebhookUrl;
      if (targetWebhook && targetWebhook.startsWith('http')) {
        const res = await fetch('/api/teams-notify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: targetWebhook,
            messageText,
            title: payload?.title || 'Huidcentrum Gent - Balie Teams Chat',
            payload
          })
        });
        return res.ok;
      }
      return true;
    } catch (e) {
      console.error('Fout bij verzenden Teams chat:', e);
      return false;
    }
  };

  return (
    <div className="flex flex-col h-full w-full bg-bg-medical min-h-screen text-text-main relative">
      
      {/* CUSTOM FLOATING TOAST NOTIFICATION */}
      {toast && (
        <div className="absolute top-4 right-4 z-[60] max-w-sm bg-slate-900 text-white rounded-xl shadow-2xl p-4 border border-slate-800 flex items-start gap-3 animate-slide-in">
          <div className="mt-0.5">
            {toast.type === 'success' && <div className="h-5 w-5 text-emerald-400 font-bold">&#10003;</div>}
            {toast.type === 'warning' && <div className="h-5 w-5 text-amber-400 font-bold">&#9888;</div>}
            {toast.type === 'info' && <div className="h-5 w-5 text-indigo-400 font-bold">&#8505;</div>}
          </div>
          <div className="flex-1">
            <p className="text-xs font-semibold">{toast.message}</p>
          </div>
          <button 
            onClick={() => setToast(null)}
            className="text-slate-400 hover:text-white font-bold text-xs cursor-pointer"
          >
            &times;
          </button>
        </div>
      )}

      {/* CUSTOM MODAL: DAGDEEL RESET CONFIRMATION */}
      {showResetConfirm && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full p-6 text-sm">
            <div className="flex items-center gap-2.5 text-amber-600 mb-3">
              <FolderSync className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-950">Activeer Nieuw Dagdeel?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              ⚠️ <strong>Bent u absoluut zeker?</strong> <br /><br />
              Bij het wisselen naar het volgende dagdeel (<strong>{tempPeriod.toUpperCase()}</strong>) worden live aangemelde patiënten gearchiveerd om de privacy- en GDPR-richtlijnen te garanderen. 
              De wachtkamers en de ondersteunende baliewerker (<strong>{activeStaffList.find(s => s.id === tempStaffId)?.name || 'Steven'}</strong>) worden geconfigureerd voor de nieuwe shifts.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setShowResetConfirm(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleExecuteDagdeelReset}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition flex items-center gap-1 cursor-pointer"
              >
                <FolderSync className="h-4 w-4" />
                Bevestig Wissel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: DOCTOR DELETION CONFIRMATION */}
      {doctorToDelete && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-sm">
            <div className="flex items-center gap-2.5 text-red-600 mb-3">
              <Trash2 className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-950">Verwijder Dermatoloog?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Weet u zeker dat u arts <strong>{doctorToDelete.name}</strong> wilt verwijderen uit het systeem? 
              Dit kan invloed hebben op patiënten die momenteel aan deze arts zijn toegewezen.
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setDoctorToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteDoctor}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Verwijder Arts
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM MODAL: STAFF DELETION CONFIRMATION */}
      {staffToDelete && (
        <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full p-6 text-sm">
            <div className="flex items-center gap-2.5 text-red-600 mb-3">
              <Trash2 className="h-6 w-6 shrink-0" />
              <h3 className="text-base font-bold text-slate-950">Verwijder Medewerker?</h3>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-4">
              Weet u zeker dat u balie-medewerker <strong>{staffToDelete.name}</strong> ({staffToDelete.role}) wilt verwijderen uit het actieve personeelsbestand?
            </p>
            <div className="flex gap-2.5 justify-end">
              <button
                type="button"
                onClick={() => setStaffToDelete(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleExecuteDeleteStaff}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold transition cursor-pointer"
              >
                Verwijder Medewerker
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* CUSTOM MODAL: ENVIRONMENT SWITCH CONFIRMATION & DEVELOPER PIN */}
      {isEnvModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden animate-fade-in text-slate-800">
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-amber-600 to-rose-600 text-white p-4 flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-white/20 backdrop-blur-xs flex items-center justify-center shrink-0">
                <ShieldAlert className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Omgeving Wisselen</h3>
                <p className="text-xs text-amber-100 font-medium">Beveiligde ontwikkelaarsactie</p>
              </div>
            </div>

            {/* Modal Content */}
            <form onSubmit={handleConfirmToggleEnvironment} className="p-5 space-y-4 text-xs">
              {/* Developer-only reminder box */}
              <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-xl text-amber-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-950 text-[13px]">
                  <span>⚠️</span>
                  <span>Belangrijke herinnering (Enkel Developer):</span>
                </div>
                <p className="leading-relaxed font-medium">
                  Het wisselen van de omgeving mag <strong>enkel en alleen door de developer</strong> worden uitgevoerd!
                </p>
                <p className="text-[11px] text-amber-800 leading-normal">
                  Deze actie schakelt per direct de database om voor alle schermen (kiosk en balie) op dit apparaat. Voer dit nooit uit tijdens normale praktijkvoering.
                </p>
              </div>

              {/* Environment transition visual */}
              <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs">
                <div>
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Huidige omgeving:</span>
                  <span className="font-semibold text-slate-700">
                    {currentEnv === 'test' ? '🧪 Test (AI Studio)' : '🚀 Productie (GitHub)'}
                  </span>
                </div>
                <div className="text-slate-400 font-bold text-base">➔</div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px] uppercase font-bold">Nieuwe omgeving:</span>
                  <span className="font-bold text-indigo-700">
                    {currentEnv === 'test' ? '🚀 Productie (GitHub)' : '🧪 Test (AI Studio)'}
                  </span>
                </div>
              </div>

              {/* PIN Code Input */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">
                  Voer beheerder / developer PIN-code in:
                </label>
                <div className="relative">
                  <input
                    type={showEnvPin ? "text" : "password"}
                    autoFocus
                    value={envPinInput}
                    onChange={(e) => {
                      setEnvPinInput(e.target.value);
                      if (envPinError) setEnvPinError(null);
                    }}
                    placeholder="Voer PIN-code in..."
                    className="w-full text-sm font-mono tracking-widest py-2.5 px-3 rounded-xl border border-slate-300 bg-white focus:outline-none focus:border-indigo-600 focus:ring-2 focus:ring-indigo-100 transition"
                  />
                  <button
                    type="button"
                    onClick={() => setShowEnvPin(!showEnvPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showEnvPin ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                {envPinError && (
                  <p className="text-rose-600 font-semibold text-[11px] pt-1 flex items-center gap-1">
                    <span>✕</span> {envPinError}
                  </p>
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsEnvModalOpen(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-semibold transition cursor-pointer"
                >
                  Annuleren
                </button>
                <button
                  type="submit"
                  disabled={!envPinInput.trim()}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white rounded-xl font-bold transition shadow-xs cursor-pointer disabled:cursor-not-allowed"
                >
                  Bevestig & Wissel Omgeving
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Tabs - Apple Glass Pill Bar */}
      <div className="bg-white/60 border-b border-black/5 px-6 py-2.5 flex justify-between items-center text-xs shrink-0 flex-wrap gap-2 backdrop-blur-md">
        <div className="flex gap-1.5 bg-slate-200/50 p-1 rounded-2xl border border-black/5 shadow-inner flex-wrap">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'overview' 
                ? 'bg-white text-slate-900 shadow-sm border border-black/5' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Users className="h-3.5 w-3.5 text-[#0071E3]" />
            Live Patiëntenoverzicht ({filteredPatients.length})
          </button>

          <button
            onClick={() => setActiveTab('timesheets')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'timesheets' 
                ? 'bg-white text-slate-900 shadow-sm border border-black/5' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Clock className="h-3.5 w-3.5 text-[#0071E3]" />
            Personeel Tiktijden
          </button>

          <button
            onClick={() => setActiveTab('leave')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'leave' 
                ? 'bg-[#0071E3] text-white font-bold shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <CalendarRange className="h-3.5 w-3.5" />
            Verlofplanning
          </button>

          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-1.5 rounded-xl font-bold transition flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'config' 
                ? 'bg-[#0071E3] text-white font-bold shadow-sm' 
                : 'text-slate-500 hover:text-slate-900'
            }`}
          >
            <Settings className={`h-3.5 w-3.5 ${activeTab === 'config' ? 'text-white' : 'text-[#0071E3]'}`} />
            Configuratie & Reset
          </button>
        </div>

        <div className="flex gap-2 items-center">
          {/* Quick Demo Assist */}
          <button
            onClick={onAddSimulatedPatient}
            className="bg-white/80 hover:bg-white text-[#0071E3] hover:text-blue-700 border border-blue-200 px-3 py-1.5 rounded-full text-xs font-semibold cursor-pointer transition flex items-center gap-1.5 shadow-2xs"
            title="Klik dit om direct een patiënt te simuleren voor snelle feedback!"
          >
            <TrendingUp className="h-3.5 w-3.5" />
            + Simuleren Patiënt
          </button>
        </div>
      </div>

      {/* CORE WORKSPACE PANELS */}
      <div className="flex-1 overflow-y-auto p-5">
        
        {/* TAB 1: LIVE PATENT LIST AND STATISTICS */}
        {activeTab === 'overview' && (
          <div className="space-y-4 animate-fade-in">
            {/* TEAMS LOGBOEK & DIRECTE CHAT MODULE (BOVENIN LIVE PATIËNTENOVERZICHT) */}
            <TeamsChatAndLogModule
              notifications={notifications}
              doctors={doctors}
              activeStaffName={activeStaffName}
              teamsWebhookUrl={systemConfig.teamsWebhookUrl}
              onClearLog={onClearNotificationLog}
              onSendTeamsMessage={handleSendTeamsChatMessage}
              onOpenConfig={() => setActiveTab('config')}
            />

            {/* Quick Micro Clinic Stats Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Totaal Aanmeldingen</div>
                  <div className="text-lg font-bold text-slate-800">{totalInDagdeel}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
                  <Hourglass className="h-5 w-5 animate-pulse" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">In de Wachtzaal</div>
                  <div className="text-lg font-bold text-slate-800">{waitingCount}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                  <UserCheck className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Binnengeroepen</div>
                  <div className="text-lg font-bold text-slate-800">{calledCount}</div>
                </div>
              </div>

              <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-sm flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-zinc-50 text-zinc-650 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5" />
                </div>
                <div>
                  <div className="text-[10px] text-slate-400 font-semibold tracking-wider uppercase">Klaars / Behandeld</div>
                  <div className="text-lg font-bold text-slate-700">{doneCount}</div>
                </div>
              </div>
            </div>

            {/* Live Filter bar and Quick lookup */}
            <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex flex-col md:flex-row gap-3">
                <div className="flex-1 relative">
                  <input
                    id="admin-search-input"
                    type="text"
                    placeholder="Zoek patiënt op naam of rijksregisternummer..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-500"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <select
                    id="admin-filter-doctor"
                    value={doctorFilter}
                    onChange={(e) => setDoctorFilter(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="all">Alle Artsen</option>
                    {doctors.map(dr => (
                      <option key={dr.id} value={dr.id}>{dr.name}</option>
                    ))}
                  </select>

                  <select
                    id="admin-filter-room"
                    value={roomFilter}
                    onChange={(e) => setRoomFilter(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="all">Alle Wachtzalen</option>
                    <option value="Gelijkvloers">Gelijkvloers (G)</option>
                    <option value="Bovenverdieping">Bovenverdieping (B)</option>
                  </select>

                  <select
                    id="admin-filter-status"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="text-xs p-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    <option value="all">Alle Statussen</option>
                    <option value="Waiting">Wachtend (Balie)</option>
                    <option value="Called">Binnengeroepen</option>
                    <option value="Done">Klaar / Behandeld</option>
                  </select>
                </div>
              </div>
            </div>

            {/* REAL-TIME PATIENT TABLE */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-[11px] sm:text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100 text-slate-500 uppercase font-mono tracking-wider font-semibold">
                      <th className="p-3">Aankomst</th>
                      <th className="p-3">Patiënt Naam</th>
                      <th className="p-3">Geboortedatum</th>
                      <th className="p-3">Rijksregisternummer</th>
                      <th className="p-3">ID-Kaartnummer</th>
                      <th className="p-3 cursor-pointer hover:bg-slate-100" onClick={() => toggleSort('appointmentTime')}>
                        Afspraak {sortBy === 'appointmentTime' ? (sortOrder === 'asc' ? '▲' : '▼') : '↕'}
                      </th>
                      <th className="p-3">Arts & Wachtzaal</th>
                      <th className="p-3 text-center">Flow Type</th>
                      <th className="p-3">Status / Actie</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredPatients.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="text-center p-8 text-slate-400 font-medium">
                          Geen actieve aanmeldingen gevonden voor de gekozen filters.
                        </td>
                      </tr>
                    ) : (
                      filteredPatients.map((patient) => {
                        const doctorColor = doctors.find(d => d.id === patient.doctorId)?.avatarColor || 'bg-slate-400';
                        return (
                          <tr key={patient.id} className="border-b border-slate-100 hover:bg-slate-50 transition">
                            <td className="p-3 font-mono text-slate-600 font-bold whitespace-nowrap">
                              {patient.arrivalTime}
                            </td>
                            <td className="p-3 font-semibold text-slate-900">
                              {patient.firstName} {patient.lastName}
                            </td>
                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                              {formatBirthDate(patient.birthDate)}
                            </td>
                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                              {patient.hasForeignNationality ? (
                                <div className="flex flex-col gap-0.5">
                                  {patient.nationalRegistryNum && patient.nationalRegistryNum !== '-' ? (
                                    <span>{formatRegistryNum(patient.nationalRegistryNum)}</span>
                                  ) : (
                                    <span className="text-zinc-400 font-sans italic text-[10px]">Geen rijksregister</span>
                                  )}
                                  <span className="inline-flex items-center text-[9px] font-sans font-medium px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200/60 w-fit">
                                    🌍 Buitenlands
                                  </span>
                                </div>
                              ) : patient.unknownIdentification ? (
                                <div className="flex flex-col gap-0.5">
                                  {patient.nationalRegistryNum && patient.nationalRegistryNum !== '-' ? (
                                    <span>{formatRegistryNum(patient.nationalRegistryNum)}</span>
                                  ) : (
                                    <span className="text-zinc-400 font-sans italic text-[10px]">Niet gekend</span>
                                  )}
                                  <span className="inline-flex items-center text-[9px] font-sans font-medium px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200/60 w-fit">
                                    ❓ ID niet gekend
                                  </span>
                                </div>
                              ) : (
                                <span>{formatRegistryNum(patient.nationalRegistryNum)}</span>
                              )}
                            </td>
                            <td className="p-3 font-mono text-slate-600 whitespace-nowrap">
                              {patient.idCardNum && patient.idCardNum !== '-' ? (
                                <span className="font-mono text-slate-700 font-medium">{patient.idCardNum}</span>
                              ) : (
                                <span className="text-zinc-400 font-sans italic text-[11px]">-</span>
                              )}
                            </td>
                            <td className="p-3 font-semibold whitespace-nowrap">
                              {patient.appointmentTime ? (
                                <span className="flex items-center gap-1 text-slate-800">
                                  <Clock className="h-3 w-3 text-indigo-500" />
                                  {patient.appointmentTime}
                                </span>
                              ) : (
                                <span className="text-zinc-400 font-semibold italic">Geen (Inloop)</span>
                              )}
                            </td>
                            <td className="p-3">
                              {patient.doctorName ? (
                                <div className="space-y-0.5">
                                  <div className="flex items-center gap-1.5 font-semibold text-slate-700">
                                    <span className={`h-2 w-2 rounded-full ${doctorColor}`}></span>
                                    {patient.doctorName}
                                  </div>
                                  <div className="text-[10px] text-slate-400 flex items-center gap-0.5">
                                    <MapPin className="h-3 w-3 text-rose-400" />
                                    Wachtzaal: {patient.waitingRoom}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-zinc-400 italic">N.v.t.</span>
                              )}
                            </td>
                            <td className="p-3 text-center">
                              {patient.flowType === 'appointment' ? (
                                <span className="bg-emerald-50 text-emerald-700 font-semibold px-2 py-0.5 rounded-full border border-emerald-100 text-[10px]">
                                  Met Afspraak
                                </span>
                              ) : patient.flowType === 'patient_info' ? (
                                <span className="bg-sky-50 text-sky-700 font-semibold px-2 py-0.5 rounded-full border border-sky-100 text-[10px]">
                                  Inlichtingen
                                </span>
                              ) : (
                                <span className="bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded-full border border-slate-200 text-[10px]">
                                  Niet-Patiënt
                                </span>
                              )}
                            </td>
                            <td className="p-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {patient.status === 'Waiting' && (
                                  <button
                                    id={`btn-call-patient-${patient.id}`}
                                    onClick={() => onUpdatePatientStatus(patient.id, 'Called')}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1 px-2.5 rounded text-[10px] shadow-sm transition"
                                  >
                                    Roep Binnen
                                  </button>
                                )}

                                {patient.status === 'Called' && (
                                  <button
                                    id={`btn-finish-patient-${patient.id}`}
                                    onClick={() => onUpdatePatientStatus(patient.id, 'Done')}
                                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-1 px-2.5 rounded text-[10px] shadow-sm transition"
                                  >
                                    Behandeld / Afgewerkt
                                  </button>
                                )}

                                {patient.status === 'Done' && (
                                  <span className="text-emerald-600 bg-emerald-50 border border-emerald-250 font-bold px-2 py-1 rounded text-[10px]">
                                    ✓ Voltooid
                                  </span>
                                )}

                                <button
                                  id={`btn-archive-patient-${patient.id}`}
                                  onClick={() => onUpdatePatientStatus(patient.id, 'Archived')}
                                  className="text-slate-400 hover:text-red-500 p-1 rounded transition"
                                  title="Archiveer/Verwijder ivm privacy"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: SYSTEM CONFIGURATION & RESET SEGMENTS */}
        {activeTab === 'config' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5 animate-fade-in text-xs sm:text-sm">
            
            {/* Dagdeel reset controller */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5">
                <FolderSync className="h-5 w-5 text-amber-500" />
                <h3 className="font-bold text-slate-800 text-base">Nieuw Dagdeel Instellen (Wachtrij Reset)</h3>
              </div>

              <div className="space-y-3">
                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 mb-1">Volgend Dagdeel:</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setTempPeriod('ochtend')}
                      className={`flex-1 py-2 text-xs rounded-lg font-bold border transition ${tempPeriod === 'ochtend' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 text-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      Ochtenddienst (Vanaf 08:00)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTempPeriod('middag')}
                      className={`flex-1 py-2 text-xs rounded-lg font-bold border transition ${tempPeriod === 'middag' ? 'bg-indigo-50 border-indigo-200 text-indigo-700 text-sm' : 'bg-slate-50 border-slate-200 text-slate-500'}`}
                    >
                      Middagdienst (Vanaf 13:30)
                    </button>
                  </div>
                </div>

                <div className="flex flex-col">
                  <label className="font-semibold text-slate-700 mb-1">Dienstdoende Balie-Ondersteuning:</label>
                  <select
                    id="setup-config-support"
                    value={tempStaffId}
                    onChange={(e) => setTempStaffId(e.target.value)}
                    className="p-2.5 rounded-lg border border-slate-200 bg-slate-50 font-semibold"
                  >
                    {activeStaffList.map(st => (
                      <option key={st.id} value={st.id}>{st.name} ({st.role})</option>
                    ))}
                  </select>
                </div>

                <div className="pt-2">
                  <button
                    onClick={runDagdeelReset}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white font-bold py-2.5 rounded-lg transition shadow-sm flex items-center justify-center gap-2 cursor-pointer text-xs"
                  >
                    <Trash2 className="h-4 w-4" />
                    Wissel Dagdeel & Archiveer Huidige Patiënten
                  </button>
                </div>
              </div>
            </div>

            {/* Doctor zaal toewijzingen & Webhook url setting */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <Settings className="h-5 w-5 text-slate-600" />
                  <h3 className="font-bold text-slate-800 text-base">Zaalindeling Artsen & Webhook</h3>
                </div>

                <form onSubmit={handleApplyConfig} className="space-y-4">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-2">Artsen & Wachtzalen Locatie:</label>
                    <div className="space-y-2 max-h-36 overflow-y-auto pr-1">
                      {doctors.map(dr => (
                        <div key={dr.id} className="flex justify-between items-center p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                          <span className="font-semibold text-slate-700">{dr.name}</span>
                          <select
                            value={tempDoctorRooms[dr.id]}
                            onChange={(e) => handleDoctorRoomChange(dr.id, e.target.value as any)}
                            className="bg-white border border-slate-200 rounded p-1 text-[11px] font-bold"
                          >
                            <option value="Gelijkvloers">Wachtzaal G (Gelijkvloers)</option>
                            <option value="Bovenverdieping">Wachtzaal B (1ste Verdiep)</option>
                          </select>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Microsoft Teams Webhook URL:
                    </label>
                    <div className="flex gap-2">
                      <input
                        id="input-admin-teams-url"
                        type="text"
                        placeholder="https://yourtenant.webhook.office.com/webhookb2/..."
                        value={tempWebhook}
                        onChange={(e) => setTempWebhook(e.target.value)}
                        className="flex-1 p-2.5 text-xs rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-indigo-500 font-mono"
                      />
                      <button
                        type="button"
                        onClick={handleTestWebhook}
                        disabled={testState === 'testing'}
                        className="bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-xs px-3 font-semibold rounded-lg shrink-0 transition cursor-pointer"
                      >
                        {testState === 'testing' ? 'Testen...' : 'Testen 🧪'}
                      </button>
                    </div>
                    {testState === 'success' && (
                      <div className="text-emerald-700 bg-emerald-50 border border-emerald-100 text-[11px] p-2 rounded mt-2 font-medium">
                        ✓ Verbindingstest succesvol verzonden! Controleer uw Power Automate flow of Microsoft Teams kanaal.
                      </div>
                    )}
                    {testState === 'failed' && (
                      <div className="text-rose-700 bg-rose-50 border border-rose-100 text-[11px] p-2 rounded mt-2 font-medium">
                        ✗ Fout bij koppeling: {testError}
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-lg transition cursor-pointer text-xs"
                    >
                      Locaties & Instellingen Opslaan
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* PINCODE & BEVEILIGING (RBAC) */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
                    <Lock className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">Pincode & Beveiliging</h3>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Admin & Balie Pincode:
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <input
                          id="input-admin-pin"
                          type={showPinMask ? 'password' : 'text'}
                          maxLength={8}
                          value={tempPin}
                          onChange={(e) => setTempPin(e.target.value.replace(/\D/g, ''))}
                          placeholder="1234"
                          className="w-full p-2.5 pr-10 text-sm tracking-widest font-mono rounded-lg border border-slate-200 bg-slate-50 focus:outline-none focus:border-amber-500 font-bold"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPinMask(!showPinMask)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 cursor-pointer"
                          title={showPinMask ? 'Toon pincode' : 'Verberg pincode'}
                        >
                          {showPinMask ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                        </button>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          if (tempPin.length < 4) {
                            showToast("Pincode moet minstens 4 cijfers bevatten.", "warning");
                            return;
                          }
                          onUpdateConfig({ adminPin: tempPin });
                          showToast("🔒 Pincode succesvol bijgewerkt!", "success");
                        }}
                        className="px-3.5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-bold text-xs transition cursor-pointer"
                      >
                        Opslaan
                      </button>
                    </div>
                    <span className="text-[10px] text-slate-400 mt-1 block">
                      Standaard ingesteld op <strong>1234</strong>. Wordt gevraagd bij openen van het beheer of ontgrendelen van de kiosk.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* GDPR & DATA RETENTION AUTOMATISERING */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 border-b border-slate-100 pb-2.5 mb-3">
                  <div className="p-1.5 rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-800 text-base">GDPR & Gegevensretentie</h3>
                  </div>
                </div>

                <div className="space-y-3.5 text-xs">
                  <div className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg border border-slate-200">
                    <div>
                      <span className="font-bold text-slate-800 block">Automatische anonimisering</span>
                      <span className="text-[10px] text-slate-500">Nachtelijke opschoning van patiëntidentifiers</span>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={tempGdprAuto}
                        onChange={(e) => {
                          const val = e.target.checked;
                          setTempGdprAuto(val);
                          onUpdateConfig({ gdprAutoAnonymize: val });
                          showToast(val ? "GDPR automatische anonimisering ingeschakeld." : "GDPR automatische anonimisering uitgeschakeld.", "info");
                        }}
                        className="sr-only peer"
                      />
                      <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
                    </label>
                  </div>

                  <div>
                    <label className="block font-semibold text-slate-700 mb-1">
                      Bewaartermijn voor identificatoren:
                    </label>
                    <select
                      value={tempRetentionHours}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setTempRetentionHours(val);
                        onUpdateConfig({ gdprRetentionHours: val });
                        showToast(`Bewaartermijn aangepast naar ${val} uur.`, "info");
                      }}
                      className="w-full p-2 rounded-lg border border-slate-200 bg-slate-50 font-semibold text-slate-800"
                    >
                      <option value={12}>12 uur (Dagdeel-gebonden)</option>
                      <option value={24}>24 uur (Aanbevolen & Standaard)</option>
                      <option value={48}>48 uur (2 dagen)</option>
                      <option value={72}>72 uur (3 dagen)</option>
                      <option value={168}>7 dagen (168 uur)</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleTriggerGdpr}
                    disabled={isGdprRunning}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white font-bold py-2 rounded-lg transition cursor-pointer text-xs flex items-center justify-center gap-1.5 shadow-xs"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isGdprRunning ? 'animate-spin' : ''}`} />
                    <span>{isGdprRunning ? 'Anonimiseren...' : 'Voer GDPR-Opschoning Nu Uit'}</span>
                  </button>
                </div>
              </div>
            </div>

            {/* IN LINE DOCTORS & STAFF MANAGEMENT GRID */}
            <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3">
              
              {/* MANAGING MEDICAL STAFF (BALIE) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-500" />
                      <div>
                        <h3 className="font-bold text-slate-800 text-base leading-tight">Personeelsleden (Balie)</h3>
                        <span className="text-[11px] text-slate-500 block">Gesynchroniseerd met Verlofplanning</span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleSyncStaff}
                      disabled={isSyncingStaff}
                      className="px-2.5 py-1 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
                      title="Synchroniseer alle balie-medewerkers en artsen direct met Personeelsbeheer in Verlofplanning"
                    >
                      <RefreshCw className={`h-3.5 w-3.5 ${isSyncingStaff ? 'animate-spin text-indigo-600' : 'text-indigo-500'}`} />
                      <span>{isSyncingStaff ? 'Synchroniseren...' : 'Sync met Verlofplanning'}</span>
                    </button>
                  </div>

                  {/* List of staff members */}
                  <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto pr-1">
                    {activeStaffList.map(st => (
                      <div key={st.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-150 text-xs">
                        {editingStaffId === st.id ? (
                          <div className="flex flex-col gap-1.5 w-full mr-2">
                            <input
                              type="text"
                              value={editingStaffName}
                              onChange={(e) => setEditingStaffName(e.target.value)}
                              className="p-1 px-2 border rounded bg-white font-semibold text-text-main text-xs"
                              placeholder="Naam medewerker"
                            />
                            <input
                              type="text"
                              value={editingStaffRole}
                              onChange={(e) => setEditingStaffRole(e.target.value)}
                              className="p-1 px-2 border rounded bg-white text-text-sub text-xs"
                              placeholder="Functie/Rol"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <span className="font-bold text-slate-800 text-sm">{st.name}</span>
                            <span className="text-slate-550 font-mono text-[10px]">{st.role}</span>
                          </div>
                        )}

                        <div className="flex gap-1.5 justify-end shrink-0">
                          {editingStaffId === st.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveStaffEdit(st.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] cursor-pointer"
                              >
                                Opslaan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingStaffId(null)}
                                className="bg-slate-300 hover:bg-slate-400 text-slate-700 font-semibold px-2 py-1 rounded text-[11px] cursor-pointer"
                              >
                                Annuleren
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingStaff(st)}
                                className="text-indigo-600 hover:bg-indigo-50 border border-indigo-150 bg-white p-1 rounded font-bold text-[10px] px-2 cursor-pointer transition animate-none"
                              >
                                Wijzig
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteStaff(st.id)}
                                className="text-red-500 hover:bg-red-50 border border-red-150 bg-white p-1 rounded cursor-pointer transition font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Staff form */}
                  <form onSubmit={handleAddStaff} className="border-t border-slate-100 pt-3 mt-3">
                    <h4 className="font-semibold text-slate-700 text-xs mb-2">Nieuwe Balie-Medewerker Toevoegen:</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="Voornaam + Achternaam"
                        value={newStaffName}
                        onChange={(e) => setNewStaffName(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                        required
                      />
                      <input
                        type="text"
                        placeholder="bijv. Hoofd Receptie of Balie"
                        value={newStaffRole}
                        onChange={(e) => setNewStaffRole(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                        required
                      />
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer transition"
                    >
                      + Voeg Toe aan Personeelsbestand
                    </button>
                  </form>
                </div>
              </div>

              {/* MANAGING DOCTORS (ARTSEN) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <SlidersHorizontal className="h-5 w-5 text-indigo-500" />
                      <h3 className="font-bold text-slate-800 text-base">Artsenbeheer (Dermatologen)</h3>
                    </div>
                  </div>

                  {/* List of doctors */}
                  <div className="space-y-2 mb-4 max-h-[220px] overflow-y-auto pr-1">
                    {doctors
                      .filter(dr => dr.id !== 'nurse-verpleegkundige' && !dr.name.toLowerCase().includes('verpleegkundige'))
                      .map(dr => (
                      <div key={dr.id} className="flex justify-between items-center p-2.5 rounded-lg bg-slate-50 border border-slate-150 text-xs">
                        {editingDocId === dr.id ? (
                          <div className="flex flex-col gap-1.5 w-full mr-2">
                            <input
                              type="text"
                              value={editingDocName}
                              onChange={(e) => setEditingDocName(e.target.value)}
                              className="p-1 px-2 border rounded bg-white font-semibold text-text-main text-xs"
                              placeholder="Doktersnaam"
                            />
                            <input
                              type="text"
                              value={editingDocSpecialty}
                              onChange={(e) => setEditingDocSpecialty(e.target.value)}
                              className="p-1 px-2 border rounded bg-white text-text-sub text-xs"
                              placeholder="Specialisme"
                            />
                            <input
                              type="text"
                              value={editingDocWebhook}
                              onChange={(e) => setEditingDocWebhook(e.target.value)}
                              className="p-1 px-2 border rounded bg-white text-slate-500 font-mono text-[10px]"
                              placeholder="Specifieke Teams Webhook URL (optioneel)"
                            />
                          </div>
                        ) : (
                          <div className="flex flex-row items-center gap-2.5">
                            <div className={`h-7 w-7 rounded-full ${dr.avatarColor || 'bg-slate-500'} text-white font-bold text-xs flex items-center justify-center shrink-0`}>
                              {dr.name.split(' ').pop()?.[0] || 'D'}
                            </div>
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm">{dr.name}</span>
                              <span className="text-slate-500 font-mono text-[10px]">{dr.specialty} &bull; <span className="font-semibold text-indigo-600">{dr.waitingRoom === 'Gelijkvloers' ? 'Zaal G' : 'Zaal B'}</span></span>
                            </div>
                          </div>
                        )}

                        <div className="flex gap-1.5 justify-end shrink-0">
                          {editingDocId === dr.id ? (
                            <>
                              <button
                                type="button"
                                onClick={() => handleSaveDocEdit(dr.id)}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold px-2.5 py-1 rounded text-[11px] cursor-pointer"
                              >
                                Opslaan
                              </button>
                              <button
                                type="button"
                                onClick={() => setEditingDocId(null)}
                                className="bg-slate-300 hover:bg-slate-400 text-slate-700 font-semibold px-2 py-1 rounded text-[11px] cursor-pointer"
                              >
                                Annuleren
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={() => startEditingDoc(dr)}
                                className="text-indigo-600 hover:bg-indigo-50 border border-indigo-150 bg-white p-1 rounded font-bold text-[10px] px-2 cursor-pointer transition"
                              >
                                Wijzig
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteDoctor(dr.id)}
                                className="text-red-500 hover:bg-red-50 border border-red-150 bg-white p-1 rounded cursor-pointer transition font-bold"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Add Doctor form */}
                  <form onSubmit={handleAddDoctor} className="border-t border-slate-100 pt-3 mt-3">
                    <h4 className="font-semibold text-slate-700 text-xs mb-2">Nieuwe Dermatoloog Toevoegen:</h4>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input
                        type="text"
                        placeholder="bijv. Dr. Jan de Vries"
                        value={newDocName}
                        onChange={(e) => setNewDocName(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:border-indigo-500 font-medium"
                        required
                      />
                      <input
                        type="text"
                        placeholder="bijv. Algemene Dermatologie"
                        value={newDocSpecialty}
                        onChange={(e) => setNewDocSpecialty(e.target.value)}
                        className="p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:border-indigo-550 font-medium"
                        required
                      />
                    </div>
                    <div className="mb-2">
                      <input
                        type="text"
                        placeholder="Specifieke Teams Webhook URL (optioneel)"
                        value={newDocWebhook}
                        onChange={(e) => setNewDocWebhook(e.target.value)}
                        className="w-full p-2 border border-slate-200 rounded-lg bg-slate-50 text-xs focus:outline-none focus:border-indigo-550 font-mono"
                      />
                    </div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-slate-600 font-semibold whitespace-nowrap">Standaard Wachtzaal:</span>
                      <select
                        value={newDocRoom}
                        onChange={(e) => setNewDocRoom(e.target.value as any)}
                        className="p-1 px-1.5 border border-slate-200 rounded bg-white text-xs font-semibold focus:outline-none focus:border-indigo-500 flex-1"
                      >
                        <option value="Gelijkvloers">Wachtzaal G (Gelijkvloers)</option>
                        <option value="Bovenverdieping">Wachtzaal B (1ste Verdieping)</option>
                      </select>
                    </div>
                    <button
                      type="submit"
                      className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-1.5 rounded-lg text-xs cursor-pointer transition"
                    >
                      + Voeg Toe aan Artsenbestand
                    </button>
                  </form>
                </div>
              </div>

              {/* Card: Data Scheiding & Testomgeving (Google AI Studio vs. GitHub) */}
              <div className="md:col-span-2 bg-gradient-to-br from-white to-slate-50/80 p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Database className="h-5 w-5 text-indigo-600" />
                    <div>
                      <h3 className="font-bold text-slate-800 text-base">
                        Data Scheiding: Testomgeving (Google AI Studio) vs. Productie (GitHub)
                      </h3>
                      <p className="text-xs text-slate-500">
                        Strikte fysieke scheiding tussen ingevoerde testdata en de actieve live omgeving.
                      </p>
                    </div>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1.5 ${
                    currentEnv === 'test' 
                      ? 'bg-amber-100 text-amber-900 border border-amber-300' 
                      : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
                  }`}>
                    <span className={`h-2 w-2 rounded-full ${currentEnv === 'test' ? 'bg-amber-500 animate-pulse' : 'bg-emerald-500'}`} />
                    Actief: {currentEnv === 'test' ? 'Testomgeving (AI Studio)' : 'Productie (GitHub)'}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                  <div className="p-3.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="font-bold text-slate-700 block mb-1 text-sm">🧪 Testomgeving (AI Studio)</span>
                    <p className="text-slate-600 leading-relaxed">
                      Alle data ingevoerd in Google AI Studio of preview-containers wordt automatisch opgeslagen in afgezonderde <code className="bg-amber-50 text-amber-700 px-1 py-0.5 rounded font-mono font-semibold">test_*</code> collecties.
                    </p>
                    <span className="inline-block mt-2 text-[11px] text-amber-700 font-semibold bg-amber-50/80 px-2 py-0.5 rounded">
                      Geen sync naar GitHub
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs">
                    <span className="font-bold text-slate-700 block mb-1 text-sm">🌐 Productie-omgeving (GitHub)</span>
                    <p className="text-slate-600 leading-relaxed">
                      De actieve GitHub Pages build (<code className="bg-slate-100 text-slate-700 px-1 py-0.5 rounded font-mono font-semibold">*.github.io</code>) gebruikt de officiële productie-collecties zonder test-voorvoegsel.
                    </p>
                    <span className="inline-block mt-2 text-[11px] text-emerald-700 font-semibold bg-emerald-50/80 px-2 py-0.5 rounded">
                      Veilig afgeschermd
                    </span>
                  </div>

                  <div className="p-3.5 bg-white rounded-lg border border-slate-200/60 shadow-2xs flex flex-col justify-between">
                    <div>
                      <span className="font-bold text-slate-700 block mb-1 text-sm">⚙️ Omgeving Wisselen</span>
                      <p className="text-slate-600 leading-relaxed">
                        Schakel handmatig tussen test- en productiedata voor validatie en beheer in de browser.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleInitiateToggleEnvironment}
                      className="mt-3 w-full bg-slate-800 hover:bg-slate-900 text-white font-semibold py-2 px-3 rounded-lg transition text-xs flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                      Schakel naar {currentEnv === 'test' ? 'Productie (GitHub)' : 'Test (AI Studio)'}
                    </button>
                  </div>
                </div>

                {/* Test Environment Tools */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-3 items-center justify-between">
                  <div className="text-xs text-slate-500">
                    Hulpfuncties voor de testomgeving:
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <button
                      type="button"
                      disabled={isCloningData}
                      onClick={handleCloneStaffToTest}
                      className="px-3 py-1.5 bg-white hover:bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      title="Kopieer de actieve artsen en balie-medewerkers van productie naar test, zodat de testomgeving direct klaar is voor gebruik."
                    >
                      <Copy className="h-3.5 w-3.5" />
                      {isCloningData ? 'Bezig met kopiëren...' : 'Kopieer Artsen & Medewerkers naar Test'}
                    </button>
                    <button
                      type="button"
                      disabled={isResettingTestData}
                      onClick={handleResetTestData}
                      className="px-3 py-1.5 bg-white hover:bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer disabled:opacity-50"
                      title="Maakt alle test_* documenten leeg zonder productie aan te raken."
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                      {isResettingTestData ? 'Bezig met wissen...' : 'Testdata Volledig Leegmaken'}
                    </button>
                  </div>
                </div>
              </div>

            </div>

          </div>
        )}

        {/* TAB 2: TIMESHEETS */}
        {activeTab === 'timesheets' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Personeel Tiktijden</h3>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Left Column: Quick Actions */}
              <div className="md:col-span-1 space-y-4">
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <h4 className="font-bold text-sm text-slate-700 mb-3">Snel In/Uit Klokken</h4>
                  <div className="flex flex-col gap-2">
                    {activeStaffList.map(staff => {
                      const todayStr = new Date().toISOString().slice(0, 10);
                      const openTs = timesheets.find(ts => ts.staffId === staff.id && ts.date === todayStr && !ts.clockOut);
                      return (
                        <div key={staff.id} className="flex justify-between items-center p-2 bg-white rounded-lg border border-slate-100 shadow-sm text-xs">
                          <span className="font-medium">{staff.name}</span>
                          {openTs ? (
                            <button onClick={() => handleClockAction(staff.id, false)} className="px-3 py-1 bg-red-100 hover:bg-red-200 text-red-700 font-bold rounded-md transition cursor-pointer">
                              Tik uit
                            </button>
                          ) : (
                            <button onClick={() => handleClockAction(staff.id, true)} className="px-3 py-1 bg-emerald-100 hover:bg-emerald-200 text-emerald-700 font-bold rounded-md transition cursor-pointer">
                              Tik in
                            </button>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>

                {isEditingTs ? (
                  <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-200 space-y-3">
                    <h4 className="font-bold text-sm text-indigo-800">{editingTsId ? 'Bewerk Tiktijd' : 'Voeg Tiktijd Toe'}</h4>
                    <form onSubmit={handleSaveTimesheet} className="space-y-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-600">Medewerker *</label>
                        <select className="w-full text-xs p-1.5 rounded-lg border border-indigo-300" value={editingTsStaff} onChange={e => setEditingTsStaff(e.target.value)} required>
                          <option value="">Selecteer medewerker</option>
                          {activeStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-indigo-600">Datum *</label>
                        <input type="date" className="w-full text-xs p-1.5 rounded-lg border border-indigo-300" value={editingTsDate} onChange={e => setEditingTsDate(e.target.value)} required />
                      </div>
                      <div className="flex gap-2">
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600">Tik in *</label>
                          <input type="time" className="w-full text-xs p-1.5 rounded-lg border border-indigo-300" value={editingTsIn} onChange={e => setEditingTsIn(e.target.value)} required />
                        </div>
                        <div className="flex-1 space-y-1">
                          <label className="text-[10px] font-bold text-indigo-600">Tik uit</label>
                          <input type="time" className="w-full text-xs p-1.5 rounded-lg border border-indigo-300" value={editingTsOut} onChange={e => setEditingTsOut(e.target.value)} />
                        </div>
                      </div>
                      <div className="flex gap-2 pt-2">
                        <button type="submit" className="flex-1 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-lg text-xs cursor-pointer">Opslaan</button>
                        <button type="button" onClick={() => setIsEditingTs(false)} className="px-3 py-1.5 bg-white hover:bg-slate-100 text-slate-600 font-bold rounded-lg text-xs border border-slate-300 cursor-pointer">Annuleren</button>
                      </div>
                    </form>
                  </div>
                ) : (
                  <button onClick={() => handleStartEditTs()} className="w-full py-2.5 border-2 border-dashed border-slate-300 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50 font-bold rounded-xl text-xs transition flex justify-center items-center gap-1 cursor-pointer">
                    <Plus className="h-4 w-4" /> Manuele tiktijd toevoegen
                  </button>
                )}
              </div>

              {/* Right Column: Monthly Overview */}
              <div className="md:col-span-2 space-y-4">
                <div className="flex items-center justify-between gap-4 flex-wrap bg-slate-50 p-3 rounded-xl border border-slate-200">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSelectedTsMonth('')}
                        className={`px-2.5 py-1 text-xs font-bold rounded-lg transition cursor-pointer ${!selectedTsMonth ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'}`}
                      >
                        Alle tiktijden ({(timesheets || []).length})
                      </button>
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="font-bold text-slate-600">Filter maand:</label>
                      <input 
                        type="month" 
                        value={selectedTsMonth} 
                        onChange={e => setSelectedTsMonth(e.target.value)} 
                        className={`p-1 rounded border text-xs ${selectedTsMonth ? 'border-indigo-500 bg-indigo-50 font-bold text-indigo-900' : 'border-slate-300 bg-white'}`} 
                      />
                      {selectedTsMonth && (
                        <button
                          type="button"
                          onClick={() => setSelectedTsMonth('')}
                          className="px-2 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold rounded text-[10px] transition cursor-pointer"
                          title="Filter wissen"
                        >
                          ✕ Wis filter
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="font-bold text-slate-600">Medewerker:</label>
                      <select value={selectedTsStaff} onChange={e => setSelectedTsStaff(e.target.value)} className="p-1 rounded border border-slate-300 max-w-[150px] bg-white">
                        <option value="all">Iedereen</option>
                        {activeStaffList.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-xl max-h-[400px] overflow-y-auto">
                  <table className="w-full text-left text-xs whitespace-nowrap">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 sticky top-0">
                      <tr>
                        <th className="p-3 font-bold">Datum</th>
                        <th className="p-3 font-bold">Medewerker</th>
                        <th className="p-3 font-bold">In</th>
                        <th className="p-3 font-bold">Uit</th>
                        <th className="p-3 font-bold">Duur</th>
                        <th className="p-3 font-bold text-right">Acties</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {(() => {
                        const filteredTs = (timesheets || []).filter(ts => {
                          if (selectedTsStaff !== 'all' && ts.staffId !== selectedTsStaff) return false;
                          if (selectedTsMonth && !(ts.date || '').startsWith(selectedTsMonth)) return false;
                          return true;
                        }).sort((a, b) => {
                          const dateA = a.date || '';
                          const dateB = b.date || '';
                          if (dateA !== dateB) return dateB.localeCompare(dateA);
                          const clockInA = a.clockIn || '';
                          const clockInB = b.clockIn || '';
                          return clockInB.localeCompare(clockInA);
                        });

                        let totalMinutes = 0;

                        if (filteredTs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400">
                                <Clock className="h-6 w-6 mx-auto mb-1.5 opacity-40 text-slate-400" />
                                <p className="font-medium text-slate-600">Geen tiktijden gevonden voor deze selectie.</p>
                                {selectedTsMonth && (timesheets || []).length > 0 && (
                                  <div className="mt-2">
                                    <p className="text-xs text-slate-400">
                                      Er zijn {(timesheets || []).length} tiktijden in andere maanden geregistreerd.
                                    </p>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedTsMonth('')}
                                      className="mt-1 inline-flex items-center text-xs font-bold text-indigo-600 hover:text-indigo-800 underline cursor-pointer"
                                    >
                                      Toon alle geregistreerde periodes
                                    </button>
                                  </div>
                                )}
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <>
                            {filteredTs.map(ts => {
                              let durStr = '-';
                              let inTimeStr = '--:--';
                              let outTimeStr: string | null = null;

                              if (ts.clockIn) {
                                const inDate = new Date(ts.clockIn);
                                if (!isNaN(inDate.getTime())) {
                                  inTimeStr = inDate.toTimeString().slice(0, 5);
                                }
                              }

                              if (ts.clockOut) {
                                const outDate = new Date(ts.clockOut);
                                if (!isNaN(outDate.getTime())) {
                                  outTimeStr = outDate.toTimeString().slice(0, 5);
                                }
                              }

                              if (ts.clockIn && ts.clockOut) {
                                const inTime = new Date(ts.clockIn).getTime();
                                const outTime = new Date(ts.clockOut).getTime();
                                if (!isNaN(inTime) && !isNaN(outTime) && outTime >= inTime) {
                                  const diffMin = Math.floor((outTime - inTime) / 60000);
                                  totalMinutes += diffMin;
                                  const h = Math.floor(diffMin / 60);
                                  const m = diffMin % 60;
                                  durStr = `${h}u ${m}m`;
                                }
                              }

                              return (
                                <tr key={ts.id} className="hover:bg-slate-50 transition">
                                  <td className="p-3 font-medium text-slate-800">{ts.date || '-'}</td>
                                  <td className="p-3 text-slate-600">{ts.staffName || '-'}</td>
                                  <td className="p-3 text-slate-600 font-mono">{inTimeStr}</td>
                                  <td className="p-3 text-slate-600 font-mono">
                                    {outTimeStr ? outTimeStr : <span className="text-emerald-600 text-[10px] bg-emerald-50 px-1 rounded font-bold">Nog ingeklokt</span>}
                                  </td>
                                  <td className="p-3 font-bold text-indigo-700">{durStr}</td>
                                  <td className="p-3 text-right space-x-2">
                                    <button onClick={() => handleStartEditTs(ts)} className="text-slate-400 hover:text-indigo-600 transition cursor-pointer" title="Bewerk">
                                      <Pencil className="h-3.5 w-3.5 inline" />
                                    </button>
                                    <button onClick={() => { if(confirm('Tiktijd verwijderen?')) onDeleteTimesheet(ts.id); }} className="text-slate-400 hover:text-red-500 transition cursor-pointer" title="Verwijder">
                                      <Trash2 className="h-3.5 w-3.5 inline" />
                                    </button>
                                  </td>
                                </tr>
                              );
                            })}
                            <tr className="bg-indigo-50 font-bold border-t-2 border-indigo-200">
                              <td colSpan={4} className="p-3 text-right text-indigo-900">Totaal deze selectie:</td>
                              <td colSpan={2} className="p-3 text-indigo-900 text-sm">
                                {Math.floor(totalMinutes / 60)}u {totalMinutes % 60}m
                              </td>
                            </tr>
                          </>
                        )
                      })()}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Google Sheets Backup & 22:00 Automation Card - Placed under intik functionaliteit */}
            <GoogleSheetsBackupSection
              timesheets={timesheets}
              staffList={activeStaffList}
              systemConfig={systemConfig}
              onUpdateConfig={onUpdateConfig}
              onRestoreTimesheets={onRestoreTimesheets}
            />
          </div>
        )}

        {/* Tab 5: Verlofplanning Module */}
        {activeTab === 'leave' && (
          <div className="p-6">
            <LeavePlanningModule
              activeStaffList={activeStaffList}
              doctors={doctors}
              onUpdateStaff={onUpdateStaff}
              onUpdateDoctors={onUpdateDoctors}
              systemConfig={systemConfig}
            />
          </div>
        )}

      </div>

      {/* FOOTER BAR: OMGEVING, KIOSK EN ONDERSTEUNING (HELEMAAL ONDERAAN) */}
      <footer className="bg-white/95 border-t border-slate-200/80 px-6 py-2.5 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0 shadow-2xs backdrop-blur-md z-10">
        {/* Left: Environment Indicator & Switcher */}
        <div className="flex items-center gap-2">
          <div className={`px-3 py-1.5 rounded-full border text-xs font-medium shadow-2xs flex items-center gap-1.5 ${
            currentEnv === 'test' 
              ? 'bg-amber-50/90 border-amber-200 text-amber-800' 
              : 'bg-emerald-50/90 border-emerald-200 text-emerald-800'
          }`}>
            <Database className={`h-3.5 w-3.5 ${currentEnv === 'test' ? 'text-amber-600' : 'text-emerald-600'}`} />
            <span>
              Omgeving: <strong className="font-semibold">{currentEnv === 'test' ? 'Test (AI Studio)' : 'Productie (GitHub)'}</strong>
            </span>
            <button
              type="button"
              onClick={handleInitiateToggleEnvironment}
              title={`Klik om te wisselen naar ${currentEnv === 'test' ? 'Productie' : 'Test'} (beveiligd met PIN & developer herinnering)`}
              className="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-white hover:bg-slate-100 text-slate-700 font-semibold cursor-pointer border border-slate-200/80 shadow-2xs transition"
            >
              Wissel
            </button>
          </div>
        </div>

        {/* Right: Kiosk and Support staff */}
        <div className="flex items-center gap-2.5 flex-wrap">
          {onSwitchView && (
            <button
              type="button"
              onClick={() => onSwitchView('kiosk')}
              className="px-3.5 py-1.5 rounded-full bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-900 border border-slate-200/80 shadow-2xs transition cursor-pointer font-semibold flex items-center gap-1.5 text-xs"
              title="Naar Kiosk (Patiënten Tablet)"
            >
              <Tablet className="h-3.5 w-3.5 text-[#0071E3]" />
              <span>Kiosk</span>
            </button>
          )}

          <div className="bg-white px-3.5 py-1.5 rounded-full border border-slate-200/80 flex items-center gap-1.5 text-slate-600 shadow-2xs">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ondersteuning: <strong className="text-slate-900">{activeStaffName}</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
