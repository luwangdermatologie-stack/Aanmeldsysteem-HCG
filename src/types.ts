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
  appointmentTime?: string; // E.g., "14:30"
  doctorId?: string;
  doctorName?: string;
  hasAppointment: boolean;
  flowType: 'patient_info' | 'non_patient' | 'appointment';
  arrivalTime: string; // Time they checked in (HH:MM:SS)
  arrivalDate: string; // Date of arrival for GDPR/audit
  waitingRoom: 'Gelijkvloers' | 'Bovenverdieping';
  status: 'Waiting' | 'Called' | 'Archived' | 'Done';
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
}

export interface TeamsNotification {
  id: string;
  timestamp: string;
  targetDoctor?: string;
  targetStaff?: string;
  payload: any;
  status: 'Success' | 'Failed' | 'Simulated';
  messagePreview: string;
}

export interface TimePunch {
  id: string;
  staffId: string;
  timestamp: string;
  type: 'in' | 'uit';
}
