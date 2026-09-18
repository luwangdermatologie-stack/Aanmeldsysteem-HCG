/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import {
  StaffMember,
  StaffRole,
  WeeklySchedule,
  LeaveRequest,
  GeneralComment
} from '../../types';
import {
  DEFAULT_FULLTIME_SCHEDULE,
  DEFAULT_EMPTY_SCHEDULE,
  STAFF_COLOR_PALETTE,
  getStaffColorConfig
} from '../../services/leaveService';
import {
  UserPlus,
  Users,
  Trash2,
  Edit2,
  AlertTriangle,
  CheckCircle2,
  ShieldAlert,
  Info,
  Check,
  X,
  UserCheck,
  RefreshCw
} from 'lucide-react';
import { ActiveStaff, Doctor } from '../../types';

interface StaffManagementSubmoduleProps {
  staffList: StaffMember[];
  leaveRequests: LeaveRequest[];
  comments: GeneralComment[];
  activeStaffList?: ActiveStaff[];
  doctors?: Doctor[];
  onSyncStaff?: () => Promise<any>;
  onAddStaffMember: (staff: Omit<StaffMember, 'id'>) => Promise<void>;
  onUpdateStaffMember: (staffId: string, updates: Partial<StaffMember>) => Promise<void>;
  onCascadeDeleteStaffMember: (staffId: string) => Promise<void>;
}

export const StaffManagementSubmodule: React.FC<StaffManagementSubmoduleProps> = ({
  staffList,
  leaveRequests,
  comments,
  activeStaffList,
  doctors: inputDoctors,
  onSyncStaff,
  onAddStaffMember,
  onUpdateStaffMember,
  onCascadeDeleteStaffMember
}) => {
  // New staff form state
  const [name, setName] = useState('');
  const [role, setRole] = useState<StaffRole>('verpleegkundige');
  const [color, setColor] = useState(STAFF_COLOR_PALETTE[staffList.length % STAFF_COLOR_PALETTE.length].hex);
  const [scheduleTemplate, setScheduleTemplate] = useState<'fulltime' | 'empty'>('fulltime');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [actionSuccess, setActionSuccess] = useState<string | null>(null);

  const handleManualSync = async () => {
    if (!onSyncStaff) return;
    setIsSyncing(true);
    try {
      await onSyncStaff();
      setActionSuccess('Personeel succesvol gesynchroniseerd met Configuratie & Reset!');
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Edit staff modal state
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [editName, setEditName] = useState('');
  const [editRole, setEditRole] = useState<StaffRole>('verpleegkundige');
  const [editColor, setEditColor] = useState('');

  // Cascade delete confirmation modal state
  const [deleteTarget, setDeleteTarget] = useState<StaffMember | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Separate staff by role
  const doctors = staffList.filter(s => s.role === 'arts');
  const nurses = staffList.filter(s => s.role === 'verpleegkundige');

  // Submit new staff
  const handleAddStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      const initialSchedule =
        scheduleTemplate === 'fulltime'
          ? JSON.parse(JSON.stringify(DEFAULT_FULLTIME_SCHEDULE))
          : JSON.parse(JSON.stringify(DEFAULT_EMPTY_SCHEDULE));

      await onAddStaffMember({
        name: name.trim(),
        role,
        color,
        schedule: initialSchedule
      });

      setName('');
      setColor(STAFF_COLOR_PALETTE[(staffList.length + 1) % STAFF_COLOR_PALETTE.length].hex);
      setActionSuccess(`Nieuw personeelslid ${name.trim()} succesvol toegevoegd!`);
      setTimeout(() => setActionSuccess(null), 3500);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Open edit modal
  const handleOpenEdit = (staff: StaffMember) => {
    const currentCfg = getStaffColorConfig(staff);
    setEditingStaff(staff);
    setEditName(staff.name);
    setEditRole(staff.role);
    setEditColor(staff.color || currentCfg.hex);
  };

  // Save edit
  const handleSaveEdit = async () => {
    if (!editingStaff || !editName.trim()) return;
    try {
      await onUpdateStaffMember(editingStaff.id, {
        name: editName.trim(),
        role: editRole,
        color: editColor
      });
      setEditingStaff(null);
      setActionSuccess('Gegevens personeelslid bijgewerkt.');
      setTimeout(() => setActionSuccess(null), 3000);
    } catch (err) {
      console.error(err);
    }
  };

  // Execute Cascade Delete
  const handleConfirmCascadeDelete = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    try {
      await onCascadeDeleteStaffMember(deleteTarget.id);
      setActionSuccess(
        `Personeelslid ${deleteTarget.name} en alle gekoppelde schema's, aanvragen en opmerkingen zijn definitief gewist.`
      );
      setDeleteTarget(null);
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      console.error(err);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* SUCCESS BANNER */}
      {actionSuccess && (
        <div className="p-3 bg-emerald-100 border border-emerald-300 rounded-xl text-emerald-900 text-xs font-semibold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{actionSuccess}</span>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 1. TOP: ADD NEW STAFF MEMBER CARD */}
      {/* ========================================================================= */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100 flex-wrap gap-2">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-indigo-50 border border-indigo-200 flex items-center justify-center text-indigo-600">
              <UserPlus className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-slate-800 text-sm">Nieuw Personeelslid Toevoegen</h3>
              <p className="text-[11px] text-slate-500">Automatisch gesynchroniseerd met Kiosk & Configuratie</p>
            </div>
          </div>
          {onSyncStaff && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer"
              title="Synchroniseer met personeel en artsen uit Configuratie & Reset"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin text-indigo-600' : 'text-indigo-500'}`} />
              <span>{isSyncing ? 'Bezig met synchroniseren...' : 'Synchroniseer met Configuratie'}</span>
            </button>
          )}
        </div>

        <form onSubmit={handleAddStaff} className="grid grid-cols-1 md:grid-cols-5 gap-3 items-end">
          <div className="md:col-span-2">
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Volledige Naam <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="bijv. Dr. Sophie Devos of Julie Maes"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Functie / Rol <span className="text-red-500">*</span>
            </label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as StaffRole)}
              className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="arts">👨‍⚕️ Arts (Dokter)</option>
              <option value="verpleegkundige">🩺 Verpleegkundige</option>
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              Kalenderkleur
            </label>
            <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200 rounded-lg p-1.5">
              <span
                className="w-4 h-4 rounded-full shrink-0 shadow-xs border border-white"
                style={{ backgroundColor: color }}
              />
              <select
                value={color}
                onChange={e => setColor(e.target.value)}
                className="w-full text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
              >
                {STAFF_COLOR_PALETTE.map(c => (
                  <option key={c.id} value={c.hex}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <button
              type="submit"
              disabled={isSubmitting || !name.trim()}
              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
            >
              <UserPlus className="w-3.5 h-3.5" />
              Personeelslid Opslaan
            </button>
          </div>
        </form>
      </div>

      {/* ========================================================================= */}
      {/* 2. PERSONEELSLIJST (ARTSEN & VERPLEEGKUNDIGEN) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* ARTSEN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-blue-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-blue-600"></span>
              <h4 className="font-extrabold text-blue-950 text-xs tracking-wide uppercase">
                Artsen ({doctors.length})
              </h4>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {doctors.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">Geen artsen geconfigureerd.</div>
            ) : (
              doctors.map(doctor => {
                const colorCfg = getStaffColorConfig(doctor);

                return (
                  <div
                    key={doctor.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white"
                        style={{ backgroundColor: colorCfg.hex }}
                        title={`Kleur: ${colorCfg.name}`}
                      />
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{doctor.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(doctor)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                        title="Bewerken"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(doctor)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Verwijderen (Cascade)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* VERPLEEGKUNDIGEN */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
          <div className="p-4 border-b border-slate-100 bg-emerald-50/50 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-600"></span>
              <h4 className="font-extrabold text-emerald-950 text-xs tracking-wide uppercase">
                Verpleegkundigen ({nurses.length})
              </h4>
            </div>
          </div>

          <div className="divide-y divide-slate-100 flex-1">
            {nurses.length === 0 ? (
              <div className="p-8 text-center text-slate-400 text-xs">Geen verpleegkundigen geconfigureerd.</div>
            ) : (
              nurses.map(nurse => {
                const colorCfg = getStaffColorConfig(nurse);

                return (
                  <div
                    key={nurse.id}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition"
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0 shadow-xs border border-white"
                        style={{ backgroundColor: colorCfg.hex }}
                        title={`Kleur: ${colorCfg.name}`}
                      />
                      <div>
                        <span className="font-bold text-slate-800 text-xs block">{nurse.name}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(nurse)}
                        className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg hover:bg-indigo-50 transition cursor-pointer"
                        title="Bewerken"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(nurse)}
                        className="p-1.5 text-slate-400 hover:text-red-600 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Verwijderen (Cascade)"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. MODAL: PERSONEELSLID BEWERKEN */}
      {/* ========================================================================= */}
      {editingStaff && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-800 text-sm">Personeelslid Bewerken</h3>
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Volledige Naam</label>
                <input
                  type="text"
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-medium text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Rol</label>
                <select
                  value={editRole}
                  onChange={e => setEditRole(e.target.value as StaffRole)}
                  className="w-full text-xs bg-slate-50 border border-slate-200 rounded-lg p-2 font-bold text-slate-800 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                >
                  <option value="arts">Arts</option>
                  <option value="verpleegkundige">Verpleegkundige</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Kalender Kleurlijn</label>
                <div className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg p-2">
                  <span
                    className="w-5 h-5 rounded-full shrink-0 shadow-xs border border-white"
                    style={{ backgroundColor: editColor }}
                  />
                  <select
                    value={editColor}
                    onChange={e => setEditColor(e.target.value)}
                    className="w-full text-xs bg-transparent font-medium text-slate-800 focus:outline-none cursor-pointer"
                  >
                    {STAFF_COLOR_PALETTE.map(c => (
                      <option key={c.id} value={c.hex}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setEditingStaff(null)}
                className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                onClick={handleSaveEdit}
                className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition cursor-pointer"
              >
                Wijzigingen Opslaan
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. MODAL: CASCADE DELETE CONFIRMATION (VEREISTE) */}
      {/* ========================================================================= */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-red-200 shadow-2xl max-w-lg w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-600">
              <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-6 h-6 text-red-600" />
              </div>
              <div>
                <h3 className="font-extrabold text-slate-900 text-base">
                  Bevestig Definitieve Cascade Verwijdering
                </h3>
                <p className="text-xs text-red-700 font-medium">
                  Let op: deze actie is onomkeerbaar en heeft betrekking op meerdere tabellen
                </p>
              </div>
            </div>

            <div className="p-3.5 bg-red-50/70 border border-red-200 rounded-xl text-xs space-y-2 text-red-950">
              <p className="font-semibold leading-relaxed">
                Bij het verwijderen van personeelslid <strong>{deleteTarget.name}</strong> worden direct en definitief gewist:
              </p>
              <ul className="list-disc pl-5 space-y-1 text-slate-700 font-medium">
                <li>Het volledige vaste werkschema van {deleteTarget.name}.</li>
                <li>
                  Alle gekoppelde verlofaanvragen ({
                    leaveRequests.filter(r => r.staff_id === deleteTarget.id).length
                  } aanvragen).
                </li>
                <li>
                  Alle algemene opmerkingen geplaatst door {deleteTarget.name} ({
                    comments.filter(c => c.author_id === deleteTarget.id).length
                  } opmerkingen).
                </li>
              </ul>
            </div>

            <div className="pt-2 flex items-center justify-end gap-3">
              <button
                type="button"
                disabled={isDeleting}
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition cursor-pointer"
              >
                Annuleren
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmCascadeDelete}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-sm"
              >
                <Trash2 className="w-4 h-4" />
                {isDeleting ? 'Verwijderen...' : 'Definitief Cascade Verwijderen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
