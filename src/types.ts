/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type LanguageCode = 'NL' | 'EN' | 'FR' | 'TR' | 'AR';

export interface Patient {
  id: string;
  firstName: string;
  lastName: string;
  birthDate: string;
  nationalRegistryNum: string; // Rijksregisternummer
  idCardNum?: string; // Identity card number
  hasForeignNationality?: boolean; // Geen Belgische nationaliteit / buitenlandse patiënt
  unknownIdentification?: boolean; // Rijksregister en/of ID niet gekend
  appointmentTime?: string; // E.g., "14:30"
  doctorId?: string;
  doctorName?: string;
  hasAppointment: boolean;
  flowType: 'patient_info' | 'non_patient' | 'appointment';
  arrivalTime: string; // Time they checked in (HH:MM:SS)
  arrivalDate: string; // Date of arrival for GDPR/audit
  waitingRoom: 'Gelijkvloers' | 'Bovenverdieping';
  status: 'Waiting' | 'Called' | 'Archived' | 'Done';
  isAnonymized?: boolean;
  anonymizedAt?: string;
  phone?: string;
  reason?: string;
}

export interface Doctor {
  id: string;
  name: string;
  specialty: string;
  waitingRoom: 'Gelijkvloers' | 'Bovenverdieping';
  isAvailable: boolean;
  avatarColor: string;
  teamsWebhookUrl?: string; // Optional MS Teams hook
}

export interface ActiveStaff {
  id: string;
  name: string;
  role: string;
}

export interface SystemConfig {
  currentDagdeel: 'ochtend' | 'middag';
  activeStaffId: string;
  teamsWebhookUrl: string;
  adminPin?: string; // Default '1234'
  kioskLocked?: boolean; // Whether kiosk is locked in fullscreen/guided access
  gdprAutoAnonymize?: boolean; // Nightly / periodic auto-anonymization
  gdprRetentionHours?: number; // E.g. 24, 48, 72 hours
  lastGdprRun?: string; // ISO timestamp
  // Google Sheets Timesheet Backup
  googleSheetsBackupEnabled?: boolean; // Daily auto backup at 22:00
  googleSheetsBackupHour?: number; // 22 by default
  googleSheetsSpreadsheetId?: string;
  googleSheetsSpreadsheetUrl?: string;
  leaveGoogleSheetsSpreadsheetId?: string;
  leaveGoogleSheetsSpreadsheetUrl?: string;
  lastGoogleSheetsBackupAt?: string;
  lastGoogleSheetsBackupStatus?: 'Success' | 'Failed' | 'Never' | 'InProgress';
  lastGoogleSheetsBackupMessage?: string;
  lastGoogleSheetsBackupCount?: number;
}

export interface TeamsNotification {
  id: string;
  timestamp: string;
  targetDoctor?: string;
  targetStaff?: string;
  sender?: string;
  category?: 'aanmelding' | 'chat' | 'spoed' | 'systeem' | string;
  payload: any;
  status: 'Success' | 'Failed' | 'Simulated';
  messagePreview: string;
}

export interface Timesheet {
  id: string;
  staffId: string;
  staffName: string;
  clockIn: string; // ISO date string
  clockOut: string | null; // ISO date string or null
  date: string; // YYYY-MM-DD
}

// ==========================================
// Verlofplanning (Leave Planning) Types
// ==========================================

export type LeaveRole = 'arts' | 'verpleegkundige';
export type StaffRole = LeaveRole;

export interface DaySchedule {
  vm: boolean; // werkt in voormiddag
  nm: boolean; // werkt in namiddag
}

export type DayOfWeekKey = 'maandag' | 'dinsdag' | 'woensdag' | 'donderdag' | 'vrijdag';

export interface WeeklySchedule {
  maandag: DaySchedule;
  dinsdag: DaySchedule;
  woensdag: DaySchedule;
  donderdag: DaySchedule;
  vrijdag: DaySchedule;
  zaterdag?: DaySchedule;
  zondag?: DaySchedule;
}

export interface StaffMember {
  id: string;
  name: string;
  role: LeaveRole;
  jobTitle?: string; // e.g. "Hoofd Receptie & Balie" or "Secretariaat"
  activeStaffId?: string; // Reference to ActiveStaff.id in Configuratie & Reset
  schedule: WeeklySchedule;
  color?: string; // Optional custom color hex or palette ID
}

export type LeaveSlot = 'VM' | 'NM' | 'HELE_DAG';
export type LeaveType = 'regulier' | 'verplicht' | 'gecompenseerd';
export type LeaveStatus = 'aangevraagd' | 'goedgekeurd' | 'afgekeurd' | 'on_hold';

export interface LeaveRequest {
  id: string;
  staff_id: string;
  staff_name?: string;
  date: string; // YYYY-MM-DD
  slot: LeaveSlot;
  units: number; // 0.5 voor VM of NM, 1.0 voor HELE_DAG
  type: LeaveType; // 'regulier' | 'verplicht' | 'gecompenseerd' (gecompenseerde werkdag trekt af van teller)
  status: LeaveStatus; // 'aangevraagd' | 'goedgekeurd' | 'afgekeurd' | 'on_hold'
  note?: string; // Optionele toelichting of planner opmerking
  created_at?: string;
}

export interface GeneralComment {
  id: string;
  week_identifier: string; // YYYY-Www (e.g. "2026-W37")
  author_id: string;
  author_name?: string;
  message: string;
  created_at: string; // ISO timestamp
}

export interface TodoItem {
  id: string;
  title: string;
  deadline?: string; // YYYY-MM-DD (optioneel)
  is_completed: boolean;
  archived: boolean;
  created_at: string; // ISO timestamp
}

export interface LeavePlanningConfig {
  googleSheetsSpreadsheetId?: string;
  googleSheetsSpreadsheetUrl?: string;
  lastBackupAt?: string;
  lastBackupStatus?: 'Success' | 'Failed' | 'Never' | 'InProgress';
  lastBackupMessage?: string;
}

