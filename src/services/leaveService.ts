/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  StaffMember,
  LeaveRequest,
  LeaveSlot,
  LeaveType,
  WeeklySchedule,
  DayOfWeekKey,
  GeneralComment,
  TodoItem
} from '../types';

export const DAYS_OF_WEEK: { key: DayOfWeekKey; label: string; short: string }[] = [
  { key: 'maandag', label: 'Maandag', short: 'Ma' },
  { key: 'dinsdag', label: 'Dinsdag', short: 'Di' },
  { key: 'woensdag', label: 'Woensdag', short: 'Woe' },
  { key: 'donderdag', label: 'Donderdag', short: 'Do' },
  { key: 'vrijdag', label: 'Vrijdag', short: 'Vr' }
];

export const createDefaultSchedule = (fullTime = true): WeeklySchedule => ({
  maandag: { vm: true, nm: true },
  dinsdag: { vm: true, nm: true },
  woensdag: { vm: true, nm: fullTime },
  donderdag: { vm: true, nm: true },
  vrijdag: { vm: true, nm: true }
});

export const DEFAULT_FULLTIME_SCHEDULE: WeeklySchedule = createDefaultSchedule(true);
export const DEFAULT_EMPTY_SCHEDULE: WeeklySchedule = {
  maandag: { vm: false, nm: false },
  dinsdag: { vm: false, nm: false },
  woensdag: { vm: false, nm: false },
  donderdag: { vm: false, nm: false },
  vrijdag: { vm: false, nm: false }
};

export interface StaffColorOption {
  id: string;
  name: string;
  hex: string;
  bgClass: string;
  borderClass: string;
  textClass: string;
  lightBgClass: string;
  badgeClass: string;
}

export const STAFF_COLOR_PALETTE: StaffColorOption[] = [
  {
    id: 'indigo',
    name: 'Indigo Blauw',
    hex: '#4F46E5',
    bgClass: 'bg-indigo-600',
    borderClass: 'border-indigo-600',
    textClass: 'text-indigo-700',
    lightBgClass: 'bg-indigo-50',
    badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200'
  },
  {
    id: 'emerald',
    name: 'Smaragdgroen',
    hex: '#059669',
    bgClass: 'bg-emerald-600',
    borderClass: 'border-emerald-600',
    textClass: 'text-emerald-700',
    lightBgClass: 'bg-emerald-50',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-200'
  },
  {
    id: 'sky',
    name: 'Hemelsblauw',
    hex: '#0284C7',
    bgClass: 'bg-sky-600',
    borderClass: 'border-sky-600',
    textClass: 'text-sky-700',
    lightBgClass: 'bg-sky-50',
    badgeClass: 'bg-sky-100 text-sky-800 border-sky-200'
  },
  {
    id: 'amber',
    name: 'Warm Amber',
    hex: '#D97706',
    bgClass: 'bg-amber-600',
    borderClass: 'border-amber-600',
    textClass: 'text-amber-700',
    lightBgClass: 'bg-amber-50',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-200'
  },
  {
    id: 'rose',
    name: 'Koraalrood',
    hex: '#E11D48',
    bgClass: 'bg-rose-600',
    borderClass: 'border-rose-600',
    textClass: 'text-rose-700',
    lightBgClass: 'bg-rose-50',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-200'
  },
  {
    id: 'violet',
    name: 'Koninklijk Paars',
    hex: '#7C3AED',
    bgClass: 'bg-violet-600',
    borderClass: 'border-violet-600',
    textClass: 'text-violet-700',
    lightBgClass: 'bg-violet-50',
    badgeClass: 'bg-violet-100 text-violet-800 border-violet-200'
  },
  {
    id: 'teal',
    name: 'Petrol / Teal',
    hex: '#0D9488',
    bgClass: 'bg-teal-600',
    borderClass: 'border-teal-600',
    textClass: 'text-teal-700',
    lightBgClass: 'bg-teal-50',
    badgeClass: 'bg-teal-100 text-teal-800 border-teal-200'
  },
  {
    id: 'fuchsia',
    name: 'Fuchsia Roze',
    hex: '#C026D3',
    bgClass: 'bg-fuchsia-600',
    borderClass: 'border-fuchsia-600',
    textClass: 'text-fuchsia-700',
    lightBgClass: 'bg-fuchsia-50',
    badgeClass: 'bg-fuchsia-100 text-fuchsia-800 border-fuchsia-200'
  },
  {
    id: 'cyan',
    name: 'Cyaan',
    hex: '#0891B2',
    bgClass: 'bg-cyan-600',
    borderClass: 'border-cyan-600',
    textClass: 'text-cyan-700',
    lightBgClass: 'bg-cyan-50',
    badgeClass: 'bg-cyan-100 text-cyan-800 border-cyan-200'
  },
  {
    id: 'crimson',
    name: 'Robijnrood',
    hex: '#DC2626',
    bgClass: 'bg-red-600',
    borderClass: 'border-red-600',
    textClass: 'text-red-700',
    lightBgClass: 'bg-red-50',
    badgeClass: 'bg-red-100 text-red-800 border-red-200'
  },
  {
    id: 'lime',
    name: 'Olijfgroen',
    hex: '#65A30D',
    bgClass: 'bg-lime-600',
    borderClass: 'border-lime-700',
    textClass: 'text-lime-800',
    lightBgClass: 'bg-lime-50',
    badgeClass: 'bg-lime-100 text-lime-900 border-lime-200'
  },
  {
    id: 'slate',
    name: 'Klassiek Leisteen',
    hex: '#475569',
    bgClass: 'bg-slate-600',
    borderClass: 'border-slate-600',
    textClass: 'text-slate-700',
    lightBgClass: 'bg-slate-100',
    badgeClass: 'bg-slate-200 text-slate-800 border-slate-300'
  }
];

/**
 * Deterministically get color configuration for a staff member
 */
export function getStaffColorConfig(staff?: StaffMember | null, fallbackIndex: number = 0): StaffColorOption {
  if (!staff) {
    return STAFF_COLOR_PALETTE[fallbackIndex % STAFF_COLOR_PALETTE.length];
  }

  // 1. If explicit color code or id is saved
  if (staff.color) {
    const found = STAFF_COLOR_PALETTE.find(
      c => c.id === staff.color || c.hex.toLowerCase() === staff.color?.toLowerCase()
    );
    if (found) return found;

    // Custom hex fallback
    if (staff.color.startsWith('#')) {
      return {
        id: 'custom',
        name: 'Aangepast',
        hex: staff.color,
        bgClass: 'bg-indigo-600',
        borderClass: 'border-indigo-600',
        textClass: 'text-indigo-700',
        lightBgClass: 'bg-indigo-50',
        badgeClass: 'bg-indigo-100 text-indigo-800 border-indigo-200'
      };
    }
  }

  // 2. Deterministic hash based on staff ID or name
  const str = staff.id || staff.name || `${fallbackIndex}`;
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  const positiveHash = Math.abs(hash);
  const colorIndex = (positiveHash + fallbackIndex) % STAFF_COLOR_PALETTE.length;
  return STAFF_COLOR_PALETTE[colorIndex];
}

export const INITIAL_LEAVE_STAFF: StaffMember[] = [
  {
    id: 'staff-dr-mertens',
    name: 'Dr. Elisabeth Mertens',
    role: 'arts',
    color: '#4F46E5', // Indigo
    schedule: {
      maandag: { vm: true, nm: true },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: true }
    }
  },
  {
    id: 'staff-dr-vancamp',
    name: 'Dr. Jasper Van Camp',
    role: 'arts',
    color: '#0284C7', // Sky blue
    schedule: {
      maandag: { vm: true, nm: true },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: false, nm: false },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: true }
    }
  },
  {
    id: 'staff-dr-nilsson',
    name: 'Dr. Linnea Nilsson',
    role: 'arts',
    color: '#7C3AED', // Violet
    schedule: {
      maandag: { vm: true, nm: true },
      dinsdag: { vm: false, nm: false },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: false, nm: false },
      vrijdag: { vm: true, nm: true }
    }
  },
  {
    id: 'staff-dr-mansour',
    name: 'Dr. Ahmed Mansour',
    role: 'arts',
    color: '#0D9488', // Teal
    schedule: {
      maandag: { vm: false, nm: false },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: false }
    }
  },
  {
    id: 'staff-karina',
    name: 'Karina Ceusters',
    role: 'verpleegkundige',
    color: '#059669', // Emerald
    schedule: {
      maandag: { vm: true, nm: true },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: true }
    }
  },
  {
    id: 'staff-steven',
    name: 'Steven De Coninck',
    role: 'verpleegkundige',
    color: '#D97706', // Amber
    schedule: {
      maandag: { vm: true, nm: true },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: false }
    }
  },
  {
    id: 'staff-mieke',
    name: 'Mieke Peeters',
    role: 'verpleegkundige',
    color: '#E11D48', // Rose
    schedule: {
      maandag: { vm: false, nm: false },
      dinsdag: { vm: true, nm: true },
      woensdag: { vm: true, nm: true },
      donderdag: { vm: true, nm: true },
      vrijdag: { vm: true, nm: true }
    }
  }
];

/**
 * Maps JS getDay() (0=Sun, 1=Mon, ..., 6=Sat) to DayOfWeekKey (excluding weekends)
 */
export function getDayKeyFromDate(d: Date): DayOfWeekKey | null {
  const dayIndex = d.getDay();
  switch (dayIndex) {
    case 1: return 'maandag';
    case 2: return 'dinsdag';
    case 3: return 'woensdag';
    case 4: return 'donderdag';
    case 5: return 'vrijdag';
    default:
      return null;
  }
}

/**
 * Returns ISO week number and year, with 5 workdays (Monday-Friday)
 */
export function getISOWeekDetails(date: Date) {
  const target = new Date(date.valueOf());
  const dayNr = (date.getDay() + 6) % 7; // Monday = 0
  target.setDate(target.getDate() - dayNr + 3);
  const firstThursday = target.valueOf();
  target.setMonth(0, 1);
  if (target.getDay() !== 4) {
    target.setMonth(0, 1 + ((4 - target.getDay()) + 7) % 7);
  }
  const weekNumber = 1 + Math.ceil((firstThursday - target.valueOf()) / 604800000);
  const year = new Date(firstThursday).getFullYear();
  const weekStr = weekNumber < 10 ? `0${weekNumber}` : `${weekNumber}`;
  const identifier = `${year}-W${weekStr}`;

  // Calculate Monday (start) and Friday (end of 5-day work week)
  const monday = new Date(date);
  const diffToMonday = (date.getDay() + 6) % 7;
  monday.setDate(date.getDate() - diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const friday = new Date(monday);
  friday.setDate(monday.getDate() + 4);
  friday.setHours(23, 59, 59, 999);

  // Generate 5 work days (Maandag t/m Vrijdag)
  const days = Array.from({ length: 5 }).map((_, i) => {
    const cur = new Date(monday);
    cur.setDate(monday.getDate() + i);
    const dayKey = getDayKeyFromDate(cur) as DayOfWeekKey;
    const yyyy = cur.getFullYear();
    const mm = String(cur.getMonth() + 1).padStart(2, '0');
    const dd = String(cur.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;
    const dayMeta = DAYS_OF_WEEK.find(d => d.key === dayKey);
    return {
      date: cur,
      dateStr,
      dayKey,
      label: dayMeta ? dayMeta.label : dayKey,
      short: dayMeta ? dayMeta.short : dayKey,
      formattedDate: `${cur.getDate()}/${cur.getMonth() + 1}`
    };
  });

  const startStr = `${String(monday.getDate()).padStart(2, '0')}/${String(monday.getMonth() + 1).padStart(2, '0')}`;
  const endStr = `${String(friday.getDate()).padStart(2, '0')}/${String(friday.getMonth() + 1).padStart(2, '0')}/${friday.getFullYear()}`;
  const formattedRange = `${startStr} - ${endStr}`;

  return {
    year,
    weekNumber,
    identifier,
    monday,
    friday,
    formattedRange,
    days
  };
}

/**
 * Validate leave request against fixed weekly schedule and role rules
 */
export function validateLeaveRequest(
  staff: StaffMember,
  dateStr: string,
  slot: LeaveSlot,
  type: LeaveType
): { valid: boolean; error?: string } {
  if (!staff) {
    return { valid: false, error: 'Selecteer een geldig personeelslid.' };
  }

  if (!dateStr) {
    return { valid: false, error: 'Selecteer een datum.' };
  }

  // Parse date
  const [year, month, day] = dateStr.split('-').map(Number);
  const dateObj = new Date(year, month - 1, day);
  if (isNaN(dateObj.getTime())) {
    return { valid: false, error: 'Ongeldige datum geselecteerd.' };
  }

  // Check if weekend (Saturday or Sunday)
  const dayOfWeek = dateObj.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return {
      valid: false,
      error: 'Zaterdag en zondag maken geen deel uit van de werk- en verlofplanning. Kies een werkdag van maandag t/m vrijdag.'
    };
  }

  const dayKey = getDayKeyFromDate(dateObj);
  if (!dayKey) {
    return { valid: false, error: 'Ongeldige weekdag gekozen.' };
  }
  const daySchedule = staff.schedule?.[dayKey] || { vm: false, nm: false };
  const dayLabel = DAYS_OF_WEEK.find(d => d.key === dayKey)?.label || dayKey;

  // 1. Role validation: Doctors can only take 'regulier'
  if (staff.role === 'arts' && type === 'verplicht') {
    return {
      valid: false,
      error: `Artsen kunnen enkel 'Regulier verlof' aanvragen. 'Verplicht verlof' is uitsluitend voorbehouden voor verpleegkundigen.`
    };
  }

  // 2. Schedule validation based on slot
  if (slot === 'VM') {
    if (!daySchedule.vm) {
      return {
        valid: false,
        error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}voormiddag (VM).`
      };
    }
  } else if (slot === 'NM') {
    if (!daySchedule.nm) {
      return {
        valid: false,
        error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}namiddag (NM).`
      };
    }
  } else if (slot === 'HELE_DAG') {
    if (!daySchedule.vm && !daySchedule.nm) {
      return {
        valid: false,
        error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}.`
      };
    }
    if (!daySchedule.vm) {
      return {
        valid: false,
        error: `Kan geen hele dag verlof aanvragen: ${staff.name} werkt op ${dayLabel} enkel in de namiddag (NM). Vraag een halve dag NM-verlof aan.`
      };
    }
    if (!daySchedule.nm) {
      return {
        valid: false,
        error: `Kan geen hele dag verlof aanvragen: ${staff.name} werkt op ${dayLabel} enkel in de voormiddag (VM). Vraag een halve dag VM-verlof aan.`
      };
    }
  }

  return { valid: true };
}

/**
 * Calculates compulsory leave counter for a nurse across all approved records
 */
export function calculateCompulsoryLeaveCounter(staffId: string, requests: LeaveRequest[]) {
  const staffRequests = requests.filter(r => r.staff_id === staffId && r.type === 'verplicht');
  
  const approved = staffRequests.filter(r => r.status === 'goedgekeurd');
  const pending = staffRequests.filter(r => r.status === 'aangevraagd');
  const rejected = staffRequests.filter(r => r.status === 'afgekeurd');

  const totalApprovedDays = approved.reduce((sum, r) => sum + (r.units || (r.slot === 'HELE_DAG' ? 1.0 : 0.5)), 0);
  const totalApprovedHalfDays = totalApprovedDays * 2;

  const totalPendingDays = pending.reduce((sum, r) => sum + (r.units || (r.slot === 'HELE_DAG' ? 1.0 : 0.5)), 0);
  const totalPendingHalfDays = totalPendingDays * 2;

  return {
    totalApprovedDays,
    totalApprovedHalfDays,
    approvedCount: approved.length,
    totalPendingDays,
    totalPendingHalfDays,
    pendingCount: pending.length,
    rejectedCount: rejected.length,
    allVerplichtCount: staffRequests.length
  };
}

/**
 * Total scheduled slots per week for a staff member (out of 10 for a 5-day week)
 */
export function getStaffWeeklyScheduledSlots(schedule?: WeeklySchedule | null): number {
  if (!schedule) return 10;
  let count = 0;
  DAYS_OF_WEEK.forEach(({ key }) => {
    if (schedule[key]?.vm) count++;
    if (schedule[key]?.nm) count++;
  });
  return count;
}

/**
 * Returns default initial sample leave requests for current week
 */
export function getDefaultSampleLeaveRequests(): LeaveRequest[] {
  const weekInfo = getISOWeekDetails(new Date());
  const wednesdayDateStr = weekInfo.days[2].dateStr;
  const thursdayDateStr = weekInfo.days[3].dateStr;
  const fridayDateStr = weekInfo.days[4].dateStr;

  return [
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
}

export interface MonthCalendarDay {
  date: Date;
  dateStr: string; // YYYY-MM-DD
  dayOfMonth: number;
  dayKey: DayOfWeekKey | null;
  dayLabel: string;
  dayShort: string;
  isCurrentMonth: boolean;
  isToday: boolean;
  isWeekend: boolean;
}

export interface MonthCalendarWeek {
  weekNumber: number;
  year: number;
  weekIdentifier: string;
  dateRangeLabel: string;
  days: MonthCalendarDay[];
}

export const MONTH_NAMES_NL = [
  'Januari',
  'Februari',
  'Maart',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Augustus',
  'September',
  'Oktober',
  'November',
  'December'
];

/**
 * Returns month calendar split into chronological weeks
 */
export function getMonthCalendarWeeks(
  year: number,
  month: number, // 0 = Jan, 8 = Sep, 11 = Dec
  includeWeekends: boolean = false
): MonthCalendarWeek[] {
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);

  // Monday of the first week
  const curWeekMonday = new Date(firstDay);
  const diffToMonday = (firstDay.getDay() + 6) % 7; // Monday = 0
  curWeekMonday.setDate(firstDay.getDate() - diffToMonday);
  curWeekMonday.setHours(0, 0, 0, 0);

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const weeks: MonthCalendarWeek[] = [];
  const daysInWeekCount = includeWeekends ? 7 : 5;

  let loopSafety = 0;
  while (curWeekMonday <= lastDay && loopSafety < 8) {
    loopSafety++;
    const weekDetails = getISOWeekDetails(curWeekMonday);

    const weekDays: MonthCalendarDay[] = [];
    for (let i = 0; i < daysInWeekCount; i++) {
      const d = new Date(curWeekMonday);
      d.setDate(curWeekMonday.getDate() + i);

      const yyyy = d.getFullYear();
      const mm = String(d.getMonth() + 1).padStart(2, '0');
      const dd = String(d.getDate()).padStart(2, '0');
      const dateStr = `${yyyy}-${mm}-${dd}`;
      const dayKey = getDayKeyFromDate(d);
      const isWeekend = d.getDay() === 0 || d.getDay() === 6;

      let label = 'Weekend';
      let short = 'Wk';
      if (dayKey) {
        const meta = DAYS_OF_WEEK.find(m => m.key === dayKey);
        if (meta) {
          label = meta.label;
          short = meta.short;
        }
      } else if (d.getDay() === 6) {
        label = 'Zaterdag';
        short = 'Za';
      } else if (d.getDay() === 0) {
        label = 'Zondag';
        short = 'Zo';
      }

      weekDays.push({
        date: d,
        dateStr,
        dayOfMonth: d.getDate(),
        dayKey,
        dayLabel: label,
        dayShort: short,
        isCurrentMonth: d.getMonth() === month,
        isToday: dateStr === todayStr,
        isWeekend
      });
    }

    const firstWeekDay = weekDays[0];
    const lastWeekDay = weekDays[weekDays.length - 1];
    const dateRangeLabel = `${String(firstWeekDay.date.getDate()).padStart(2, '0')}/${String(firstWeekDay.date.getMonth() + 1).padStart(2, '0')} - ${String(lastWeekDay.date.getDate()).padStart(2, '0')}/${String(lastWeekDay.date.getMonth() + 1).padStart(2, '0')}`;

    weeks.push({
      weekNumber: weekDetails.weekNumber,
      year: weekDetails.year,
      weekIdentifier: weekDetails.identifier,
      dateRangeLabel,
      days: weekDays
    });

    // Advance to next Monday
    curWeekMonday.setDate(curWeekMonday.getDate() + 7);
  }

  return weeks;
}
