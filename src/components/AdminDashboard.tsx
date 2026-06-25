/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Patient, Doctor, ActiveStaff, SystemConfig, TeamsNotification, Timesheet } from '../types';
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
  Plus,
  Pencil
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
  onDeleteTimesheet
}: AdminDashboardProps) {
  // Tabs and filters inside Admin
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'notifications' | 'timesheets'>('overview');
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

  // Timesheets management
  const [selectedTsMonth, setSelectedTsMonth] = useState<string>(new Date().toISOString().slice(0, 7));
  const [selectedTsStaff, setSelectedTsStaff] = useState<string>('all');
  const [isEditingTs, setIsEditingTs] = useState(false);
  const [editingTsId, setEditingTsId] = useState<string>('');
  const [editingTsStaff, setEditingTsStaff] = useState<string>('');
  const [editingTsDate, setEditingTsDate] = useState<string>('');
  const [editingTsIn, setEditingTsIn] = useState<string>('');
  const [editingTsOut, setEditingTsOut] = useState<string>('');

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

  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newStaffName.trim() || !newStaffRole.trim()) return;
    const newSt: ActiveStaff = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole.trim()
    };
    onUpdateStaff([...activeStaffList, newSt]);
    setNewStaffName('');
    setNewStaffRole('');
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
    showToast(`Medewerker ${staffToDelete.name} is succesvol verwijderd uit het personeelsbestand.`, "success");
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
      teamsWebhookUrl: tempWebhook
    });

    // Save doctor assignments
    const updatedDoctors = doctors.map(dr => ({
      ...dr,
      waitingRoom: tempDoctorRooms[dr.id] || dr.waitingRoom
    }));
    onUpdateDoctors(updatedDoctors);

    showToast("⚙️ Configuratie succesvol opgeslagen en toegepast!", "success");
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
      const matchSearch = 
        `${p.firstName} ${p.lastName}`.toLowerCase().includes(searchTerm.toLowerCase()) || 
        p.nationalRegistryNum.includes(searchTerm);
      const matchDoc = doctorFilter === 'all' || p.doctorId === doctorFilter;
      const matchRoom = roomFilter === 'all' || p.waitingRoom === roomFilter;
      const matchStatus = statusFilter === 'all' || p.status === statusFilter;
      
      return matchSearch && matchDoc && matchRoom && matchStatus;
    })
    .sort((a, b) => {
      let valA = '';
      let valB = '';
      
      if (sortBy === 'arrivalTime') {
        valA = a.arrivalTime;
        valB = b.arrivalTime;
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

  // Helper to mask Rijksregisternummer
  const formatRegistryNum = (num: string): string => {
    if (!gdprMaskActive) return num;
    if (num === '-' || num.length < 6) return num;
    // Replace middle parts for security
    // e.g. 85.08.14-123.45 to 85.**.**-***.**
    return num.replace(/\d/g, (char, index) => {
      if (index < 2 || index > 12) return char;
      if (char === '.' || char === '-') return char;
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

  return (
    <div className="flex flex-col h-full bg-bg-medical min-h-[490px] rounded-2xl overflow-hidden shadow-md text-text-main relative">
      
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
      
      {/* Admin Panel Header Banner */}
      <div className="bg-button-beige text-text-main px-6 py-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2 border-b border-border-soft shrink-0">
        <div className="flex items-center gap-3">
          <div className="bg-white p-2 rounded-lg border border-border-soft">
            <Settings className="h-5 w-5 text-text-sub" />
          </div>
          <div>
            <h2 className="text-lg font-bold tracking-tight flex items-center gap-2">
              Dermato-Care Portaal 
              <span className="text-[11px] font-semibold bg-button-active text-text-main rounded-md px-2 py-0.5 border border-border-soft">
                Live Beheer
              </span>
            </h2>
            <p className="text-xs text-text-sub">
              Dashboard voor dokters en ondersteuning &bull; Actief dagdeel: <strong className="text-text-main capitalize">{systemConfig.currentDagdeel}</strong>
            </p>
          </div>
        </div>

        {/* Action controls inside header */}
        <div className="flex gap-2 text-xs flex-wrap">
          <div className="bg-white px-3 py-1.5 rounded-lg border border-border-soft flex items-center gap-1.5 text-text-sub">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse"></span>
            Ondersteuning: <strong className="text-text-main">{activeStaffName}</strong>
          </div>
          <button
            onClick={() => setActiveTab('config')}
            className={`px-3.5 py-1.5 rounded-lg border transition cursor-pointer font-semibold ${activeTab === 'config' ? 'bg-button-active border-border-soft hover:bg-button-active/85 text-text-main' : 'bg-white border-border-soft text-text-sub hover:bg-bg-medical'}`}
          >
            Configuratie & Reset
          </button>
        </div>
      </div>

      {/* Admin Tabs */}
      <div className="bg-white border-b border-border-soft px-6 py-2.5 flex justify-between items-center text-xs shrink-0 flex-wrap gap-2">
        <div className="flex gap-2">
          <button
            onClick={() => setActiveTab('overview')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'overview' ? 'bg-bg-medical text-text-main font-bold' : 'text-text-sub hover:text-text-main'}`}
          >
            <Users className="h-4 w-4 text-text-sub" />
            Live Patiëntenoverzicht ({filteredPatients.length})
          </button>
          
          <button
            onClick={() => setActiveTab('notifications')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 relative cursor-pointer ${activeTab === 'notifications' ? 'bg-bg-medical text-text-main font-bold' : 'text-text-sub hover:text-text-main'}`}
          >
            <BellRing className="h-4 w-4 text-text-sub" />
            Teams Logboek
            {notifications.length > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-500 text-white text-[10px] h-4.5 min-w-4.5 px-1 rounded-full flex items-center justify-center font-bold">
                {notifications.length}
              </span>
            )}
          </button>

          <button
            onClick={() => setActiveTab('timesheets')}
            className={`px-4 py-2 rounded-lg font-bold transition flex items-center gap-1.5 cursor-pointer ${activeTab === 'timesheets' ? 'bg-bg-medical text-text-main font-bold' : 'text-text-sub hover:text-text-main'}`}
          >
            <Clock className="h-4 w-4 text-text-sub" />
            Personeel Tiktijden
          </button>
        </div>

        <div className="flex gap-3 items-center">
          {/* Quick Demo Assist */}
          <button
            onClick={onAddSimulatedPatient}
            className="bg-accent-peach text-text-main hover:bg-accent-peach/85 border border-border-soft px-2.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition flex items-center gap-1"
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
                        <td colSpan={8} className="text-center p-8 text-slate-400 font-medium">
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
                              {formatRegistryNum(patient.nationalRegistryNum)}
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
              <p className="text-slate-500 text-xs leading-relaxed">
                Een medische dermatologische praktijk werkt in twee discrete dagdelen. Selecteer de nieuwe patiëntenverdeling, wijs de dokters toe aan hun zalen en selecteer de ondersteunende baliewerker.
              </p>

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
                    <span className="text-[10px] text-[#A68F8A] mt-1 block leading-normal">
                      Indien leeg gelaten, worden de notificaties prachtig doorgestuurd en getoond in het speciaal ingebouwde "Teams Logboek" tabblad hiernaast.
                    </span>
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

            {/* IN LINE DOCTORS & STAFF MANAGEMENT GRID */}
            <div className="md:col-span-2 grid grid-cols-1 lg:grid-cols-2 gap-5 pt-3">
              
              {/* MANAGING MEDICAL STAFF (BALIE) */}
              <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-500" />
                      <h3 className="font-bold text-slate-800 text-base">Medewerkersbeheer (Balie)</h3>
                    </div>
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
                    {doctors.map(dr => (
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

            </div>

          </div>
        )}

        {/* TAB 3: TEAMS NOTIFICATION DICTIONARY & LOG */}
        {activeTab === 'notifications' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <BellRing className="h-5 w-5 text-indigo-500 animate-bounce" />
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Microsoft Teams Webhook Feed</h3>
                  <p className="text-xs text-slate-400">Verzonden berichten en payloads naar het artsen- en baliekanaal</p>
                </div>
              </div>

              <button
                onClick={onClearNotificationLog}
                className="text-slate-400 hover:text-red-500 text-xs flex items-center gap-1 cursor-pointer font-semibold"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Log Leegmaken
              </button>
            </div>

            {notifications.length === 0 ? (
              <div className="text-center p-8 text-slate-400 space-y-2">
                <HelpCircle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="font-medium text-xs">Er zijn nog geen Microsoft Teams notificaties uitgestuurd.</p>
                <p className="text-[10px] text-slate-400">Gebruik de Kiosk app om een patiënt aan te melden.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[290px] overflow-y-auto pr-2">
                {notifications.map((notif) => (
                  <div key={notif.id} className="p-3.5 rounded-xl border border-slate-150 bg-slate-50 flex flex-col sm:flex-row justify-between gap-3 text-xs">
                    <div className="space-y-1.5 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-slate-500 font-bold bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                          {notif.timestamp}
                        </span>
                        
                        <span className="font-semibold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded text-[10px] border border-indigo-100">
                          Bestemming: {notif.targetDoctor || notif.targetStaff || 'Algemeen'}
                        </span>

                        <span className="bg-emerald-50 text-emerald-700 border border-emerald-150 px-2 py-0.5 rounded text-[10px] font-bold">
                          HTTP 200 {notif.status}
                        </span>
                      </div>

                      <div className="text-[#2C2121] leading-relaxed select-all border-l-2 border-slate-300 pl-2 py-1 bg-white rounded shadow-sm text-[11px] font-mono">
                        {notif.messagePreview}
                      </div>
                    </div>

                    <div className="text-[9px] font-mono bg-slate-900 text-slate-300 p-2 rounded-lg max-w-sm overflow-x-auto select-all shrink-0">
                      <div className="text-indigo-400 font-semibold mb-1">Payload JSON:</div>
                      <pre>{JSON.stringify(notif.payload, null, 2)}</pre>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 4: TIMESHEETS */}
        {activeTab === 'timesheets' && (
          <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-sm space-y-4 animate-fade-in">
            <div className="flex justify-between items-center border-b border-slate-100 pb-2.5">
              <div className="flex items-center gap-2">
                <Clock className="h-5 w-5 text-indigo-500" />
                <div>
                  <h3 className="font-bold text-slate-800 text-base">Personeel Tiktijden</h3>
                  <p className="text-xs text-slate-400">Intik- en uittik klok en maandelijks overzicht</p>
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
                  <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 text-xs">
                      <label className="font-bold text-slate-600">Maand:</label>
                      <input type="month" value={selectedTsMonth} onChange={e => setSelectedTsMonth(e.target.value)} className="p-1 rounded border border-slate-300" />
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <label className="font-bold text-slate-600">Medewerker:</label>
                      <select value={selectedTsStaff} onChange={e => setSelectedTsStaff(e.target.value)} className="p-1 rounded border border-slate-300 max-w-[150px]">
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
                        const filteredTs = timesheets.filter(ts => {
                          if (selectedTsStaff !== 'all' && ts.staffId !== selectedTsStaff) return false;
                          return ts.date.startsWith(selectedTsMonth);
                        }).sort((a, b) => {
                          if (a.date !== b.date) return b.date.localeCompare(a.date);
                          return b.clockIn.localeCompare(a.clockIn);
                        });

                        let totalMinutes = 0;

                        if (filteredTs.length === 0) {
                          return (
                            <tr>
                              <td colSpan={6} className="p-6 text-center text-slate-400">
                                Geen tiktijden gevonden voor deze selectie.
                              </td>
                            </tr>
                          )
                        }

                        return (
                          <>
                            {filteredTs.map(ts => {
                              let durStr = '-';
                              if (ts.clockOut) {
                                const inTime = new Date(ts.clockIn).getTime();
                                const outTime = new Date(ts.clockOut).getTime();
                                const diffMin = Math.floor((outTime - inTime) / 60000);
                                totalMinutes += diffMin;
                                const h = Math.floor(diffMin / 60);
                                const m = diffMin % 60;
                                durStr = `${h}u ${m}m`;
                              }

                              const inDate = new Date(ts.clockIn);
                              const outDate = ts.clockOut ? new Date(ts.clockOut) : null;

                              return (
                                <tr key={ts.id} className="hover:bg-slate-50 transition">
                                  <td className="p-3 font-medium text-slate-800">{ts.date}</td>
                                  <td className="p-3 text-slate-600">{ts.staffName}</td>
                                  <td className="p-3 text-slate-600 font-mono">{inDate.toTimeString().slice(0, 5)}</td>
                                  <td className="p-3 text-slate-600 font-mono">
                                    {outDate ? outDate.toTimeString().slice(0, 5) : <span className="text-emerald-600 text-[10px] bg-emerald-50 px-1 rounded font-bold">Nog ingeklokt</span>}
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
                              )
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
          </div>
        )}

      </div>
    </div>
  );
}
