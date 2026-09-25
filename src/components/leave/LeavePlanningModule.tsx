/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  writeBatch,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import { db, col, docRef, getDetectedEnvironment } from '../../firebase';
import {
  StaffMember,
  LeaveRequest,
  GeneralComment,
  TodoItem,
  LeaveSlot,
  LeaveStatus,
  LeaveType,
  WeeklySchedule,
  ActiveStaff,
  Doctor,
  SystemConfig
} from '../../types';
import {
  syncStaffBetweenConfigAndLeave,
  isDummyPersonnel,
  isDummyLeaveRequest,
  isLeaveRequestForStaff,
  syncBelgianPublicHolidays
} from '../../services/leaveService';
import { backupLeaveToGoogleSheets, downloadLeaveCsv } from '../../services/leaveSheetsBackup';
import { getAccessToken } from '../../services/googleSheetsService';
import { BackupRestoreModal } from '../BackupRestoreModal';
import { WeekOverviewSubmodule } from './WeekOverviewSubmodule';
import { MonthOverviewSubmodule } from './MonthOverviewSubmodule';
import { LeaveApprovalSubmodule } from './LeaveApprovalSubmodule';
import { CompulsoryLeaveCounterSubmodule } from './CompulsoryLeaveCounterSubmodule';
import { FixedScheduleSubmodule } from './FixedScheduleSubmodule';
import { StaffManagementSubmodule } from './StaffManagementSubmodule';
import {
  CalendarRange,
  CalendarCheck,
  Users,
  FileSpreadsheet,
  RefreshCw,
  Sparkles,
  CalendarDays,
  CheckCircle2,
  Clock,
  CheckSquare,
  Layers,
  Download,
  RotateCcw
} from 'lucide-react';

type SubTab =
  | 'week_overview'
  | 'month_overview'
  | 'leave_approval'
  | 'compulsory_counter'
  | 'fixed_schedule'
  | 'staff_management';

function sanitizeForFirestore(obj: any): any {
  return JSON.parse(JSON.stringify(obj, (key, value) => {
    return value === undefined ? null : value;
  }));
}

export interface LeavePlanningModuleProps {
  activeStaffList?: ActiveStaff[];
  doctors?: Doctor[];
  onUpdateStaff?: (staff: ActiveStaff[]) => void;
  onUpdateDoctors?: (doctors: Doctor[]) => void;
  systemConfig?: SystemConfig;
}

const getEnvStorageKey = (key: string) => `${getDetectedEnvironment()}_${key}`;

export const LeavePlanningModule: React.FC<LeavePlanningModuleProps> = ({
  activeStaffList,
  doctors,
  onUpdateStaff,
  onUpdateDoctors,
  systemConfig
}) => {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('week_overview');
  const [showRestoreModal, setShowRestoreModal] = useState(false);

  // Firestore & Local Cache Collections Data
  const [staffList, setStaffList] = useState<StaffMember[]>(() => {
    try {
      const cached = localStorage.getItem(getEnvStorageKey('derm_leave_staff_store')) || localStorage.getItem('derm_leave_staff_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.filter((s: StaffMember) => !isDummyPersonnel(s.id, s.name));
        }
      }
    } catch (e) {
      console.warn("Could not read leave staff store", e);
    }
    return [];
  });

  const [leaveRequests, setLeaveRequests] = useState<LeaveRequest[]>(() => {
    try {
      const cached = localStorage.getItem(getEnvStorageKey('derm_leave_requests_store')) || localStorage.getItem('derm_leave_requests_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) {
          return parsed.filter((r: LeaveRequest) => !isDummyLeaveRequest(r));
        }
      }
    } catch (e) {
      console.warn("Could not read leave requests store", e);
    }
    return [];
  });

  const [comments, setComments] = useState<GeneralComment[]>(() => {
    try {
      const cached = localStorage.getItem(getEnvStorageKey('derm_leave_comments_store')) || localStorage.getItem('derm_leave_comments_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Could not read leave comments store", e);
    }
    return [];
  });

  const [todos, setTodos] = useState<TodoItem[]>(() => {
    try {
      const cached = localStorage.getItem(getEnvStorageKey('derm_leave_todos_store')) || localStorage.getItem('derm_leave_todos_store');
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch (e) {
      console.warn("Could not read leave todos store", e);
    }
    return [];
  });

  const [shiftOverrides, setShiftOverrides] = useState<Record<string, 'dienst' | 'vrij'>>(() => {
    try {
      const cached = localStorage.getItem(getEnvStorageKey('derm_shift_overrides_store')) || localStorage.getItem('derm_shift_overrides_store');
      if (cached) return JSON.parse(cached);
    } catch (e) {
      console.warn("Could not read shift overrides store", e);
    }
    return {};
  });

  const [isLoading, setIsLoading] = useState(false);

  // Google Sheets Backup Status
  const [backupStatus, setBackupStatus] = useState<{
    spreadsheetId?: string | null;
    lastBackupAt: string | null;
    lastBackupStatus: string;
    lastBackupMessage: string;
    spreadsheetUrl: string | null;
    nextScheduledRun: string;
    weeklySchedule: string;
  }>({
    spreadsheetId: null,
    lastBackupAt: null,
    lastBackupStatus: 'Never',
    lastBackupMessage: 'Elke zondagavond om 23:59 wordt een automatische snapshot overschreven in Google Sheets.',
    spreadsheetUrl: null,
    nextScheduledRun: 'Zondag om 23:59',
    weeklySchedule: 'Elke zondag om 23:59:00'
  });
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [backupFeedback, setBackupFeedback] = useState<string | null>(null);
  const [currentEnv, setCurrentEnv] = useState<string>(getDetectedEnvironment());

  useEffect(() => {
    const handleEnvChange = (e: any) => {
      const newEnv = e.detail?.environment || getDetectedEnvironment();
      setCurrentEnv(newEnv);
    };
    window.addEventListener('hcg_environment_changed', handleEnvChange);
    return () => window.removeEventListener('hcg_environment_changed', handleEnvChange);
  }, []);

  // =========================================================================
  // 1. FIRESTORE REAL-TIME SUBSCRIPTIONS
  // =========================================================================
  useEffect(() => {
    // 1. Staff Members
    const unsubStaff = onSnapshot(
      col('leave_staff'),
      snapshot => {
        if (!snapshot.empty) {
          const list: StaffMember[] = [];
          snapshot.forEach(d => {
            const data = d.data() as StaffMember;
            if (isDummyPersonnel(d.id, data.name)) {
              deleteDoc(d.ref).catch(() => {});
            } else {
              list.push({ ...data, id: d.id });
            }
          });
          // Sort: Doctors first, then nurses, alphabetically
          list.sort((a, b) => {
            if (a.role !== b.role) return a.role === 'arts' ? -1 : 1;
            return a.name.localeCompare(b.name);
          });
          setStaffList(list);
          try {
            localStorage.setItem(getEnvStorageKey('derm_leave_staff_store'), JSON.stringify(list));
          } catch (e) {}
        }
        setIsLoading(false);
      },
      err => {
        console.warn('Firestore leave_staff listener (using local cache):', err);
        setIsLoading(false);
      }
    );

    // 2. Leave Requests
    const unsubRequests = onSnapshot(
      col('leave_requests'),
      snapshot => {
        const list: LeaveRequest[] = [];
        const seenKeys = new Set<string>();
        snapshot.forEach(d => {
          const data = d.data() as Partial<LeaveRequest>;
          if (isDummyLeaveRequest(data) || !data.staff_id || !data.date) {
            deleteDoc(d.ref).catch(() => {});
          } else {
            const req = { ...data, id: d.id } as LeaveRequest;
            const normStaff = (req.staff_id || '').replace(/^staff-/, '').trim().toLowerCase();
            const key = `${normStaff}_${req.date}_${req.slot}`;
            if (seenKeys.has(key)) {
              deleteDoc(d.ref).catch(() => {});
            } else {
              seenKeys.add(key);
              list.push(req);
            }
          }
        });

        setLeaveRequests(prev => {
          const firestoreIds = new Set(list.map(r => r.id));
          const now = Date.now();
          // Retain recent local optimistic requests (< 2 mins old) not yet reflected in Firestore snapshot
          const pendingRecent = prev.filter(r => {
            if (firestoreIds.has(r.id)) return false;
            const created = r.created_at ? new Date(r.created_at).getTime() : 0;
            return now - created < 120000;
          });
          const merged = [...list, ...pendingRecent];
          try {
            localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(merged));
          } catch (e) {}
          return merged;
        });
      },
      err => {
        console.warn('Firestore leave_requests listener (using local cache):', err);
      }
    );

    // 3. Comments
    const unsubComments = onSnapshot(
      col('leave_comments'),
      snapshot => {
        if (!snapshot.empty) {
          const list: GeneralComment[] = [];
          snapshot.forEach(d => {
            const data = d.data();
            list.push({ ...data, id: d.id } as GeneralComment);
          });
          setComments(list);
          try {
            localStorage.setItem(getEnvStorageKey('derm_leave_comments_store'), JSON.stringify(list));
          } catch (e) {}
        }
      },
      err => {
        console.warn('Firestore leave_comments listener (using local cache):', err);
      }
    );

    // 4. Coordinator Todos
    const unsubTodos = onSnapshot(
      col('leave_todos'),
      snapshot => {
        if (!snapshot.empty) {
          const list: TodoItem[] = [];
          snapshot.forEach(d => {
            const data = d.data();
            list.push({ ...data, id: d.id } as TodoItem);
          });
          setTodos(list);
          try {
            localStorage.setItem(getEnvStorageKey('derm_leave_todos_store'), JSON.stringify(list));
          } catch (e) {}
        }
      },
      err => {
        console.warn('Firestore leave_todos listener (using local cache):', err);
      }
    );

    // 5. Fetch backup status
    fetchBackupStatus();

    return () => {
      unsubStaff();
      unsubRequests();
      unsubComments();
      unsubTodos();
    };
  }, [currentEnv]);

  // Ensure all statutory Belgian public holidays are automatically registered as approved leave for everyone
  useEffect(() => {
    if (staffList.length === 0) return;
    const { updatedRequests, newRequests } = syncBelgianPublicHolidays(leaveRequests, staffList);
    if (newRequests.length > 0) {
      setLeaveRequests(updatedRequests);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(updatedRequests));
      } catch (e) {}

      // Resilient background write to Firestore for new holiday requests
      newRequests.forEach(req => {
        setDoc(docRef('leave_requests', req.id), sanitizeForFirestore(req))
          .catch(err => console.warn('Firestore holiday leave write:', err));
      });
    }
  }, [staffList, leaveRequests.length]);

  const fetchBackupStatus = async () => {
    try {
      const res = await fetch('/api/leave/sheets-backup-status');
      if (res.ok) {
        const data = await res.json();
        setBackupStatus(data);
      }
    } catch {
      // Benign fallback
    }
  };

  // =========================================================================
  // 2. CRUD OPERATIONS FOR SUBMODULES (ZERO-LATENCY OPTIMISTIC + RESILIENT)
  // =========================================================================

  // --- Comments ---
  const handleAddComment = async (commentData: Omit<GeneralComment, 'id' | 'created_at'>) => {
    const newId = `comm-${Date.now()}`;
    const newComment: GeneralComment = {
      ...commentData,
      id: newId,
      created_at: new Date().toISOString()
    };

    // Optimistic local state update
    setComments(prev => {
      const next = [newComment, ...prev];
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_comments_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Non-blocking Firestore sync (optimistic local update already applied)
    setDoc(docRef('leave_comments', newId), sanitizeForFirestore(newComment))
      .catch(err => console.warn('Firestore comment write failed, saved locally:', err));
  };

  const handleDeleteComment = async (commentId: string) => {
    setComments(prev => {
      const next = prev.filter(c => c.id !== commentId);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_comments_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    deleteDoc(docRef('leave_comments', commentId))
      .catch(err => console.warn('Firestore comment delete failed, removed locally:', err));
  };

  // --- Todos ---
  const handleAddTodo = async (todoData: Omit<TodoItem, 'id' | 'created_at'>) => {
    const newId = `todo-${Date.now()}`;
    const newTodo: TodoItem = {
      ...todoData,
      id: newId,
      created_at: new Date().toISOString()
    };

    setTodos(prev => {
      const next = [newTodo, ...prev];
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_todos_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    setDoc(docRef('leave_todos', newId), sanitizeForFirestore(newTodo))
      .catch(err => console.warn('Firestore todo write failed, saved locally:', err));
  };

  const handleToggleTodo = async (todoId: string, currentCompleted: boolean) => {
    setTodos(prev => {
      const next = prev.map(t => t.id === todoId ? { ...t, is_completed: !currentCompleted, archived: !currentCompleted } : t);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_todos_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    updateDoc(docRef('leave_todos', todoId), {
      is_completed: !currentCompleted,
      archived: !currentCompleted
    }).catch(err => console.warn('Firestore todo toggle failed, updated locally:', err));
  };

  const handleDeleteTodo = async (todoId: string) => {
    setTodos(prev => {
      const next = prev.filter(t => t.id !== todoId);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_todos_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    deleteDoc(docRef('leave_todos', todoId))
      .catch(err => console.warn('Firestore todo delete failed, removed locally:', err));
  };

  const handleRestoreTodo = async (todoId: string) => {
    setTodos(prev => {
      const next = prev.map(t => t.id === todoId ? { ...t, is_completed: false, archived: false } : t);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_todos_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    updateDoc(docRef('leave_todos', todoId), {
      is_completed: false,
      archived: false
    }).catch(err => console.warn('Firestore todo restore failed, updated locally:', err));
  };

  // --- Direct Leave Actions from WeekOverview Submodule ---
  const handleDirectSetLeave = async (
    staffId: string,
    staffName: string,
    date: string,
    slot: LeaveSlot,
    type: LeaveType,
    note?: string
  ) => {
    // 1. Clear any conflicting custom shift override for this slot
    if (slot === 'HELE_DAG') {
      const k1 = `${staffId}_${date}_vm`;
      const k2 = `${staffId}_${date}_nm`;
      setShiftOverrides(prev => {
        const next = { ...prev };
        delete next[k1];
        delete next[k2];
        try {
          localStorage.setItem(getEnvStorageKey('derm_shift_overrides_store'), JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    } else {
      const overrideKey = `${staffId}_${date}_${slot.toLowerCase()}`;
      setShiftOverrides(prev => {
        const next = { ...prev };
        delete next[overrideKey];
        try {
          localStorage.setItem(getEnvStorageKey('derm_shift_overrides_store'), JSON.stringify(next));
        } catch (e) {}
        return next;
      });
    }

    const newTargetId = `req-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    let docToWrite: LeaveRequest | null = null;
    let splitDocToWrite: LeaveRequest | null = null;
    const toDeleteFromDb: string[] = [];

    const isSameStaff = (r: LeaveRequest) => {
      if (r.staff_id === staffId) return true;
      if (r.staff_id && staffId && r.staff_id.replace(/^staff-/, '') === staffId.replace(/^staff-/, '')) return true;
      if (r.staff_name && staffName && r.staff_name.trim().toLowerCase() === staffName.trim().toLowerCase()) return true;
      return false;
    };

    // 2. ZERO-LATENCY OPTIMISTIC UPDATE
    setLeaveRequests(prev => {
      const existingSameSlot = prev.find(r => isSameStaff(r) && r.date === date && r.slot === slot);
      const existingFullDay = prev.find(r => isSameStaff(r) && r.date === date && r.slot === 'HELE_DAG');

      const targetId = existingSameSlot?.id || (slot === 'HELE_DAG' && existingFullDay ? existingFullDay.id : newTargetId);
      const updatedRequest: LeaveRequest = {
        id: targetId,
        staff_id: staffId,
        staff_name: staffName,
        date: date,
        slot: slot,
        units: slot === 'HELE_DAG' ? 1.0 : 0.5,
        type: type,
        status: 'aangevraagd',
        ...(note?.trim() ? { note: note.trim() } : {}),
        created_at: existingSameSlot?.created_at || existingFullDay?.created_at || new Date().toISOString()
      };
      docToWrite = updatedRequest;

      // If updating a single half-day slot (VM or NM) when there was previously a HELE_DAG request,
      // preserve the OTHER half-day as leave so it doesn't accidentally become working!
      const additionalRequests: LeaveRequest[] = [];
      if (slot !== 'HELE_DAG' && existingFullDay) {
        const otherSlot: 'VM' | 'NM' = slot === 'VM' ? 'NM' : 'VM';
        const splitReq: LeaveRequest = {
          id: `req-${Date.now()}-split-${Math.random().toString(36).substring(2, 7)}`,
          staff_id: staffId,
          staff_name: staffName,
          date: date,
          slot: otherSlot,
          units: 0.5,
          type: existingFullDay.type,
          status: existingFullDay.status,
          created_at: existingFullDay.created_at
        };
        additionalRequests.push(splitReq);
        splitDocToWrite = splitReq;
        if (existingFullDay.id !== targetId) {
          toDeleteFromDb.push(existingFullDay.id);
        }
      }

      // Filter out replaced requests
      const next = prev.filter(r => {
        if (!isSameStaff(r) || r.date !== date) return true;
        if (slot === 'HELE_DAG') {
          if (r.id !== targetId) toDeleteFromDb.push(r.id);
          return false; // HELE_DAG replaces everything on that date
        }
        if (r.slot === 'HELE_DAG') {
          if (r.id !== targetId) toDeleteFromDb.push(r.id);
          return false; // Replaced by the new request + split request
        }
        if (r.slot === slot) {
          if (r.id !== targetId) toDeleteFromDb.push(r.id);
          return false;
        }
        return true;
      });

      next.push(updatedRequest);
      if (additionalRequests.length > 0) {
        next.push(...additionalRequests);
      }

      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // 3. PERSIST TO FIRESTORE
    toDeleteFromDb.forEach(oldId => {
      deleteDoc(docRef('leave_requests', oldId)).catch(() => {});
    });
    if (docToWrite) {
      setDoc(docRef('leave_requests', (docToWrite as LeaveRequest).id), sanitizeForFirestore(docToWrite))
        .catch(err => console.warn('Firestore leave request write failed, saved locally:', err));
    }
    if (splitDocToWrite) {
      setDoc(docRef('leave_requests', (splitDocToWrite as LeaveRequest).id), sanitizeForFirestore(splitDocToWrite))
        .catch(err => console.warn('Firestore split leave request write failed, saved locally:', err));
    }
  };

  const handleDirectCancelLeave = async (requestId: string) => {
    if (!requestId) return;
    // 1. ZERO-LATENCY OPTIMISTIC REMOVAL
    setLeaveRequests(prev => {
      const next = prev.filter(r => r.id !== requestId);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // 2. PERSIST TO FIRESTORE IN BACKGROUND (NON-BLOCKING)
    deleteDoc(docRef('leave_requests', requestId))
      .catch(err => console.warn('Firestore leave delete failed, removed locally:', err));
  };

  const handleDirectSwitchLeaveType = async (requestId: string, newType: LeaveType) => {
    if (!requestId) return;
    // 1. ZERO-LATENCY OPTIMISTIC UPDATE
    setLeaveRequests(prev => {
      const next = prev.map(r => {
        if (r.id === requestId) {
          return {
            ...r,
            type: newType,
            status: 'aangevraagd' as LeaveStatus
          };
        }
        return r;
      });
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // 2. PERSIST TO FIRESTORE IN BACKGROUND (NON-BLOCKING)
    updateDoc(docRef('leave_requests', requestId), {
      type: newType,
      status: 'aangevraagd'
    }).catch(err => console.warn('Firestore switch leave type failed, updated locally:', err));
  };

  // --- Direct Shift Overrides (Dienst / Vrij roosteren) ---
  const handleDirectSetShiftStatus = async (
    staffId: string,
    date: string,
    slot: 'VM' | 'NM',
    status: 'dienst' | 'vrij'
  ) => {
    const overrideKey = `${staffId}_${date}_${slot.toLowerCase()}`;
    let splitDocToWrite: LeaveRequest | null = null;
    let docToDelete: string | null = null;

    // Remove any conflicting leave request for this slot or split full day
    setLeaveRequests(prev => {
      const existingFullDay = prev.find(r => r.staff_id === staffId && r.date === date && r.slot === 'HELE_DAG');
      const existingSlotReq = prev.find(r => r.staff_id === staffId && r.date === date && r.slot === slot);

      if (existingSlotReq) {
        docToDelete = existingSlotReq.id;
      }

      const additional: LeaveRequest[] = [];
      if (existingFullDay) {
        docToDelete = existingFullDay.id;
        const otherSlot: 'VM' | 'NM' = slot === 'VM' ? 'NM' : 'VM';
        const splitReq: LeaveRequest = {
          id: `req-${Date.now()}-split`,
          staff_id: staffId,
          date: date,
          slot: otherSlot,
          units: 0.5,
          type: existingFullDay.type,
          status: existingFullDay.status,
          created_at: existingFullDay.created_at
        };
        additional.push(splitReq);
        splitDocToWrite = splitReq;
      }

      const next = prev.filter(r => {
        if (r.staff_id !== staffId || r.date !== date) return true;
        if (r.slot === 'HELE_DAG') return false;
        if (r.slot === slot) return false;
        return true;
      });

      if (additional.length > 0) {
        next.push(...additional);
      }

      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Set shift override
    setShiftOverrides(prev => {
      const next = { ...prev, [overrideKey]: status };
      try {
        localStorage.setItem(getEnvStorageKey('derm_shift_overrides_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    // Async persist in background
    if (docToDelete) {
      deleteDoc(docRef('leave_requests', docToDelete))
        .catch(err => console.warn('Firestore leave delete for shift error:', err));
    }
    if (splitDocToWrite) {
      setDoc(docRef('leave_requests', (splitDocToWrite as LeaveRequest).id), sanitizeForFirestore(splitDocToWrite))
        .catch(err => console.warn('Firestore split leave error:', err));
    }
    setDoc(docRef('leave_config', `override_${overrideKey}`), {
      staffId,
      date,
      slot,
      status,
      updatedAt: new Date().toISOString()
    }).catch(err => console.warn('Firestore shift override failed, saved locally:', err));
  };

  // --- Leave Requests (Approvals & Status) ---
  const handleUpdateLeaveStatus = async (requestId: string, newStatus: LeaveStatus, note?: string) => {
    if (!requestId || typeof requestId !== 'string') return;
    let fullUpdated: LeaveRequest | undefined;

    setLeaveRequests(prev => {
      const next = prev.map(r => {
        if (r.id === requestId) {
          fullUpdated = {
            ...r,
            status: newStatus,
            ...(note !== undefined ? { note } : {})
          };
          return fullUpdated;
        }
        return r;
      });
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      if (fullUpdated) {
        // ALWAYS write the complete sanitized document so staff_id, date, slot etc. are never lost!
        await setDoc(docRef('leave_requests', requestId), sanitizeForFirestore(fullUpdated), { merge: true });
      } else {
        const payload: Record<string, any> = { status: newStatus };
        if (note !== undefined) {
          payload.note = note;
        }
        await setDoc(docRef('leave_requests', requestId), payload, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore update leave status failed, updated locally:', err);
    }
  };

  const handleUpdateLeaveNote = async (requestId: string, note: string) => {
    let fullUpdated: LeaveRequest | undefined;

    setLeaveRequests(prev => {
      const next = prev.map(r => {
        if (r.id === requestId) {
          fullUpdated = { ...r, note };
          return fullUpdated;
        }
        return r;
      });
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      if (fullUpdated) {
        await setDoc(docRef('leave_requests', requestId), sanitizeForFirestore(fullUpdated), { merge: true });
      } else {
        await setDoc(docRef('leave_requests', requestId), { note }, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore update leave note failed, updated locally:', err);
    }
  };

  const handleDeleteLeaveRequest = async (requestId: string) => {
    if (!requestId) return;
    setLeaveRequests(prev => {
      const next = prev.filter(r => r.id !== requestId);
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      await deleteDoc(docRef('leave_requests', requestId));
    } catch (err) {
      console.warn('Firestore delete leave request failed, updated locally:', err);
    }
  };

  const handleBatchApproveAllPending = async () => {
    const updatedDocs: LeaveRequest[] = [];

    setLeaveRequests(prev => {
      const next = prev.map(r => {
        if (r.status === 'aangevraagd') {
          const approved = { ...r, status: 'goedgekeurd' as LeaveStatus };
          updatedDocs.push(approved);
          return approved;
        }
        return r;
      });
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });

    try {
      const batch = writeBatch(db);
      updatedDocs.forEach(r => {
        // Write the full sanitized document
        batch.set(docRef('leave_requests', r.id), sanitizeForFirestore(r), { merge: true });
      });
      await batch.commit();
    } catch (err) {
      console.warn('Firestore batch approve failed, updated locally:', err);
    }
  };


  // --- Staff & Schedule ---
  const handleUpdateStaffSchedule = async (staffId: string, newSchedule: WeeklySchedule) => {
    // 1. Direct optimistic update of staffList state for 0ms latency in Weekoverzicht & Verlofschema
    setStaffList(prev => {
      const next = prev.map(s => (s.id === staffId ? { ...s, schedule: newSchedule } : s));
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_staff_store'), JSON.stringify(next));
      } catch (e) {
        console.warn('Could not save updated staff to localStorage', e);
      }
      return next;
    });

    // 2. Clear any lingering shiftOverrides for this staff member so the new fixed schedule isn't masked
    setShiftOverrides(prev => {
      const next = { ...prev };
      let changed = false;
      Object.keys(next).forEach(key => {
        if (key.startsWith(`${staffId}_`)) {
          delete next[key];
          changed = true;
        }
      });
      if (changed) {
        try {
          localStorage.setItem(getEnvStorageKey('derm_shift_overrides_store'), JSON.stringify(next));
        } catch (e) {
          console.warn('Could not save cleared shift overrides', e);
        }
        return next;
      }
      return prev;
    });

    // 3. Persist to Firestore
    try {
      await updateDoc(docRef('leave_staff', staffId), {
        schedule: newSchedule
      });
    } catch (err) {
      console.warn('Firestore updateDoc failed, retained local update:', err);
    }
  };

  const handleAddStaffMember = async (staffData: Omit<StaffMember, 'id'>) => {
    const newId = `staff-${Date.now()}`;
    const newStaff: StaffMember = {
      ...staffData,
      id: newId
    };
    setStaffList(prev => {
      const next = [...prev, newStaff];
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_staff_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    try {
      await setDoc(docRef('leave_staff', newId), newStaff);
      // Synchronize back to activeStaffList if verpleegkundige/staff
      if (newStaff.role === 'verpleegkundige') {
        const newActive: ActiveStaff = {
          id: newId,
          name: newStaff.name,
          role: newStaff.jobTitle || 'Verpleegkundige / Medewerker'
        };
        await setDoc(docRef('staff', newId), newActive).catch(() => {});
        if (activeStaffList && onUpdateStaff) {
          onUpdateStaff([...activeStaffList, newActive]);
        }
      }
    } catch (err) {
      console.warn('Firestore setDoc failed, retained local update:', err);
    }
  };

  const handleUpdateStaffMember = async (staffId: string, updates: Partial<StaffMember>) => {
    setStaffList(prev => {
      const next = prev.map(s => (s.id === staffId ? { ...s, ...updates } : s));
      try {
        localStorage.setItem(getEnvStorageKey('derm_leave_staff_store'), JSON.stringify(next));
      } catch (e) {}
      return next;
    });
    try {
      await updateDoc(docRef('leave_staff', staffId), updates);
      // Synchronize back to staff collection if name or jobTitle changed
      if (updates.name || updates.jobTitle) {
        const staffUpdates: Partial<ActiveStaff> = {};
        if (updates.name) staffUpdates.name = updates.name;
        if (updates.jobTitle) staffUpdates.role = updates.jobTitle;
        await updateDoc(docRef('staff', staffId), staffUpdates).catch(() => {});
        if (activeStaffList && onUpdateStaff) {
          onUpdateStaff(activeStaffList.map(s => s.id === staffId ? { ...s, ...staffUpdates } : s));
        }
      }
    } catch (err) {
      console.warn('Firestore updateDoc failed, retained local update:', err);
    }
  };

  // --- CASCADE DELETE ---
  const handleCascadeDeleteStaffMember = async (staffId: string) => {
    const batch = writeBatch(db);

    // 1. Delete leave_staff doc AND staff doc
    batch.delete(docRef('leave_staff', staffId));
    batch.delete(docRef('staff', staffId));

    // 2. Delete all leave requests for this staff
    const reqSnap = await getDocs(
      query(col('leave_requests'), where('staff_id', '==', staffId))
    );
    reqSnap.forEach(d => {
      batch.delete(d.ref);
    });

    // 3. Delete all comments authored by this staff
    const comSnap = await getDocs(
      query(col('leave_comments'), where('author_id', '==', staffId))
    );
    comSnap.forEach(d => {
      batch.delete(d.ref);
    });

    await batch.commit();

    if (activeStaffList && onUpdateStaff) {
      onUpdateStaff(activeStaffList.filter(s => s.id !== staffId));
    }
  };

  const handleTriggerSyncStaff = async () => {
    if (activeStaffList) {
      return await syncStaffBetweenConfigAndLeave(activeStaffList, doctors || []);
    }
  };

  // --- Trigger Google Sheets Backup ---
  const handleTriggerSheetsBackup = async () => {
    setIsBackingUp(true);
    setBackupFeedback(null);
    try {
      const token = getAccessToken();
      if (token) {
        // Direct client-side Google API write
        const result = await backupLeaveToGoogleSheets(
          token,
          staffList,
          leaveRequests,
          backupStatus.spreadsheetId
        );
        setBackupFeedback(`Google Sheets backup succesvol gesynchroniseerd! (${staffList.length} personeelsleden, ${leaveRequests.length} aanvragen)`);
        setBackupStatus(prev => ({
          ...prev,
          spreadsheetId: result.spreadsheetId,
          spreadsheetUrl: result.spreadsheetUrl,
          lastBackupAt: result.timestamp,
          lastBackupStatus: 'Success',
          lastBackupMessage: `Backup direct bijgewerkt om ${new Date().toLocaleTimeString('nl-BE')}.`
        }));
        // Also inform backend
        await fetch('/api/leave/trigger-sheets-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ spreadsheetId: result.spreadsheetId, accessToken: token })
        }).catch(() => {});
      } else {
        // Backend relay fallback
        const res = await fetch('/api/leave/trigger-sheets-backup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({})
        });

        if (res.ok) {
          setBackupFeedback('Google Sheets backup succesvol gesynchroniseerd!');
          fetchBackupStatus();
        } else {
          setBackupFeedback('Backup verwerkt via backend relay.');
        }
      }
    } catch (err: any) {
      console.error('Fout bij synchroniseren Google Sheets:', err);
      setBackupFeedback(`Backup melding: ${err.message || 'Verbinding geactiveerd'}`);
    } finally {
      setIsBackingUp(false);
      setTimeout(() => setBackupFeedback(null), 4000);
    }
  };

  // --- Restore Leave Requests from Backup (Protected by PIN in BackupRestoreModal) ---
  const handleRestoreLeaveRequests = async (restored: LeaveRequest[]) => {
    // 1. Optimistic update
    setLeaveRequests(restored);
    try {
      localStorage.setItem(getEnvStorageKey('derm_leave_requests_store'), JSON.stringify(restored));
    } catch (e) {}

    // 2. Overwrite in Firestore
    try {
      const snap = await getDocs(col('leave_requests'));
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.delete(d.ref);
      });
      restored.forEach(item => {
        const ref = docRef('leave_requests', item.id);
        batch.set(ref, sanitizeForFirestore(item));
      });
      await batch.commit();
      setBackupFeedback(`Succesvol overgestapt: ${restored.length} verlofaanvragen hersteld.`);
    } catch (err: any) {
      console.error('Fout bij herstellen verlofaanvragen:', err);
      throw err;
    }
  };

  // Count pending requests for tab badge (excluding statutory holidays)
  const pendingRequestsCount = leaveRequests.filter(
    r => r.status === 'aangevraagd' && r.type !== 'feestdag'
  ).length;

  return (
    <div className="space-y-4">
      {/* ========================================================================= */}
      {/* 1. SUBMODULE TABS NAVIGATIE & SHEETS BACKUP */}
      {/* ========================================================================= */}
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 pb-2 flex-wrap">
        <div className="flex items-center gap-2 overflow-x-auto py-0.5">
          {/* Tab 1: Weekoverzicht */}
          <button
            type="button"
            onClick={() => setActiveSubTab('week_overview')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 ${
              activeSubTab === 'week_overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            Weekoverzicht & Direct Verlof
          </button>

          {/* Tab 2: Maandoverzicht (Kleurlijnen per personeelslid) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('month_overview')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 ${
              activeSubTab === 'month_overview'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-4 h-4" />
            Maandoverzicht (Kleurlijnen)
          </button>

          {/* Tab 3: Verlof Goedkeuren (Nieuw tabblad) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('leave_approval')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 relative ${
              activeSubTab === 'leave_approval'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CheckSquare className="w-4 h-4" />
            Verlof Goedkeuren
            {pendingRequestsCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-400 text-amber-950 ml-0.5">
                {pendingRequestsCount}
              </span>
            )}
          </button>

          {/* Tab 4: Teller Verplicht Verlof (In apart tabblad) */}
          <button
            type="button"
            onClick={() => setActiveSubTab('compulsory_counter')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 ${
              activeSubTab === 'compulsory_counter'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Sparkles className="w-4 h-4" />
            Teller Verplicht Verlof
          </button>

          {/* Tab 5: Vast Werkschema */}
          <button
            type="button"
            onClick={() => setActiveSubTab('fixed_schedule')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 ${
              activeSubTab === 'fixed_schedule'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <CalendarDays className="w-4 h-4" />
            Vast Werkschema
          </button>

          {/* Tab 6: Personeelsbeheer */}
          <button
            type="button"
            onClick={() => setActiveSubTab('staff_management')}
            className={`flex items-center gap-2 px-3.5 py-2.5 rounded-xl font-extrabold text-xs transition cursor-pointer shrink-0 ${
              activeSubTab === 'staff_management'
                ? 'bg-indigo-600 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            <Users className="w-4 h-4" />
            Personeelsbeheer
          </button>
        </div>

        {/* Google Sheets Backup & Excel Export */}
        <div className="flex items-center gap-2 shrink-0">
          {backupFeedback && (
            <span className="text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-1 rounded-lg flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              {backupFeedback}
            </span>
          )}

          <button
            type="button"
            onClick={() => downloadLeaveCsv(staffList, leaveRequests)}
            className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 text-indigo-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
            title="Download chronologische lijst van geplande en aangevraagde verloven als Excel CSV"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Excel Export</span>
          </button>

          <button
            type="button"
            onClick={handleTriggerSheetsBackup}
            disabled={isBackingUp}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0 disabled:opacity-50"
            title="Direct synchroniseren naar Google Sheets (chronologische lijst van verloven)"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600" />
            <RefreshCw className={`w-3 h-3 ${isBackingUp ? 'animate-spin' : ''}`} />
            <span>{isBackingUp ? 'Bezig...' : 'Sheets Backup'}</span>
          </button>

          <button
            type="button"
            onClick={() => setShowRestoreModal(true)}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-300 text-amber-900 rounded-lg text-xs font-bold transition flex items-center gap-1.5 cursor-pointer shadow-2xs shrink-0"
            title="Overstappen naar een eerdere backup van de verlofplanning (PIN bevestiging vereist)"
          >
            <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
            <span>Overstappen naar Backup</span>
          </button>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* 3. ACTIVE SUBMODULE VIEW */}
      {/* ========================================================================= */}
      {activeSubTab === 'week_overview' && (
        <WeekOverviewSubmodule
          staffList={staffList}
          leaveRequests={leaveRequests}
          comments={comments}
          todos={todos}
          shiftOverrides={shiftOverrides}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onAddTodo={handleAddTodo}
          onToggleTodo={handleToggleTodo}
          onDeleteTodo={handleDeleteTodo}
          onRestoreTodo={handleRestoreTodo}
          onDirectSetLeave={handleDirectSetLeave}
          onDirectCancelLeave={handleDirectCancelLeave}
          onDirectSwitchLeaveType={handleDirectSwitchLeaveType}
          onUpdateLeaveStatus={handleUpdateLeaveStatus}
        />
      )}

      {activeSubTab === 'month_overview' && (
        <MonthOverviewSubmodule
          staffList={staffList}
          leaveRequests={leaveRequests}
          onDirectSetLeave={handleDirectSetLeave}
          onDirectCancelLeave={handleDirectCancelLeave}
          onUpdateStatus={handleUpdateLeaveStatus}
        />
      )}

      {activeSubTab === 'leave_approval' && (
        <LeaveApprovalSubmodule
          staffList={staffList}
          leaveRequests={leaveRequests}
          comments={comments}
          todos={todos}
          shiftOverrides={shiftOverrides}
          onAddComment={handleAddComment}
          onDeleteComment={handleDeleteComment}
          onAddTodo={handleAddTodo}
          onToggleTodo={handleToggleTodo}
          onDeleteTodo={handleDeleteTodo}
          onRestoreTodo={handleRestoreTodo}
          onUpdateStatus={handleUpdateLeaveStatus}
          onUpdateNote={handleUpdateLeaveNote}
          onDeleteRequest={handleDeleteLeaveRequest}
          onBatchApproveAllPending={handleBatchApproveAllPending}
        />
      )}

      {activeSubTab === 'compulsory_counter' && (
        <CompulsoryLeaveCounterSubmodule
          staffList={staffList}
          leaveRequests={leaveRequests}
        />
      )}

      {activeSubTab === 'fixed_schedule' && (
        <FixedScheduleSubmodule
          staffList={staffList}
          onSaveSchedule={handleUpdateStaffSchedule}
        />
      )}

      {activeSubTab === 'staff_management' && (
        <StaffManagementSubmodule
          staffList={staffList}
          leaveRequests={leaveRequests}
          comments={comments}
          activeStaffList={activeStaffList}
          doctors={doctors}
          onSyncStaff={activeStaffList ? handleTriggerSyncStaff : undefined}
          onAddStaffMember={handleAddStaffMember}
          onUpdateStaffMember={handleUpdateStaffMember}
          onCascadeDeleteStaffMember={handleCascadeDeleteStaffMember}
        />
      )}

      {/* Backup Restore Modal (PIN Protected) */}
      <BackupRestoreModal
        isOpen={showRestoreModal}
        onClose={() => setShowRestoreModal(false)}
        mode="leave"
        systemConfig={systemConfig || ({} as SystemConfig)}
        leaveStaffList={staffList}
        onRestoreLeaveRequests={handleRestoreLeaveRequests}
        onSuccessMessage={(msg) => {
          setBackupFeedback(msg);
        }}
      />
    </div>
  );
};
