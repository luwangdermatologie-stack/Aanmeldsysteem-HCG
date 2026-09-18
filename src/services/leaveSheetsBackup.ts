/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffMember, LeaveRequest, GeneralComment, TodoItem } from '../types';
import { DAYS_OF_WEEK, calculateCompulsoryLeaveCounter, getStaffWeeklyScheduledSlots } from './leaveService';

/**
 * Get or create Google Spreadsheet for Leave Planning
 */
export const getOrCreateLeaveSpreadsheet = async (
  token: string,
  existingId?: string
): Promise<{ id: string; url: string }> => {
  if (existingId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${existingId}?fields=spreadsheetId,properties.title`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (checkRes.ok) {
        const data = await checkRes.json();
        return {
          id: data.spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`
        };
      }
    } catch (e) {
      console.warn('Kan bestaande verlof sheet niet verifiëren, nieuwe wordt gecreëerd:', e);
    }
  }

  // Create new spreadsheet with the 3 requested tabs
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `DermatoMed - Verlofplanning & Personeelsschema's Backup`
      },
      sheets: [
        {
          properties: {
            title: 'Personeel & Schemas',
            gridProperties: { frozenRowCount: 1 }
          }
        },
        {
          properties: {
            title: 'Verlofaanvragen',
            gridProperties: { frozenRowCount: 1 }
          }
        },
        {
          properties: {
            title: 'Verplicht Verlof Teller',
            gridProperties: { frozenRowCount: 1 }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Fout bij aanmaken Google Sheet voor Verlofplanning: ${errText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;

  // Initialize Headers
  const staffHeaders = [
    'Personeelslid',
    'Rol',
    'Maandag (VM / NM)',
    'Dinsdag (VM / NM)',
    'Woensdag (VM / NM)',
    'Donderdag (VM / NM)',
    'Vrijdag (VM / NM)',
    'Totaal Ingeroosterde Dagdelen/Week'
  ];

  const requestHeaders = [
    'Aanvraag ID',
    'Datum',
    'Personeelslid',
    'Rol',
    'Dagdeel',
    'Eenheden (Dagen)',
    'Type Verlof',
    'Status',
    'Aangemaakt Op'
  ];

  const compulsoryHeaders = [
    'Verpleegkundige',
    'Rol',
    'Totaal Goedgekeurd Verplicht Verlof (Dagen)',
    'Totaal Halve Dagen (0.5x)',
    'In Aanvraag (Nog goed te keuren)',
    'Aantal Aanvragen Verplicht Verlof',
    'Status Teller'
  ];

  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: "'Personeel & Schemas'!A1:H1",
            values: [staffHeaders]
          },
          {
            range: "'Verlofaanvragen'!A1:I1",
            values: [requestHeaders]
          },
          {
            range: "'Verplicht Verlof Teller'!A1:G1",
            values: [compulsoryHeaders]
          }
        ]
      })
    }
  );

  return {
    id: spreadsheetId,
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`
  };
};

/**
 * Perform complete weekly synchronization to Google Sheets
 */
export const backupLeaveToGoogleSheets = async (
  token: string,
  staffList: StaffMember[],
  requests: LeaveRequest[],
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; timestamp: string }> => {
  const sheetMeta = await getOrCreateLeaveSpreadsheet(token, existingSpreadsheetId);
  const spreadsheetId = sheetMeta.id;
  const now = new Date().toISOString();

  // 1. Build Tab: Personeel & Schemas
  const staffRows = staffList.map(member => {
    const formatDay = (key: any) => {
      const sched = member.schedule?.[key] || { vm: false, nm: false };
      if (sched.vm && sched.nm) return 'VM + NM (Hele dag)';
      if (sched.vm) return 'Enkel VM';
      if (sched.nm) return 'Enkel NM';
      return 'Niet ingeroosterd';
    };

    return [
      member.name,
      member.role === 'arts' ? 'Arts' : 'Verpleegkundige',
      formatDay('maandag'),
      formatDay('dinsdag'),
      formatDay('woensdag'),
      formatDay('donderdag'),
      formatDay('vrijdag'),
      `${getStaffWeeklyScheduledSlots(member.schedule)} / 10 dagdelen`
    ];
  });

  // 2. Build Tab: Verlofaanvragen
  const sortedRequests = [...requests].sort((a, b) => (b.date || '').localeCompare(a.date || ''));
  const requestRows = sortedRequests.map(r => {
    const staff = staffList.find(s => s.id === r.staff_id);
    const staffName = r.staff_name || staff?.name || r.staff_id;
    const role = staff ? (staff.role === 'arts' ? 'Arts' : 'Verpleegkundige') : '-';
    
    return [
      r.id,
      r.date,
      staffName,
      role,
      r.slot,
      r.units?.toString() || (r.slot === 'HELE_DAG' ? '1.0' : '0.5'),
      r.type === 'verplicht' ? 'Verplicht Verlof' : 'Regulier Verlof',
      r.status.toUpperCase(),
      r.created_at || now
    ];
  });

  // 3. Build Tab: Verplicht Verlof Teller (only nurses)
  const nurses = staffList.filter(s => s.role === 'verpleegkundige');
  const compulsoryRows = nurses.map(nurse => {
    const counter = calculateCompulsoryLeaveCounter(nurse.id, requests);
    return [
      nurse.name,
      'Verpleegkundige',
      `${counter.totalApprovedDays} dag(en)`,
      `${counter.totalApprovedHalfDays} halve dagen`,
      `${counter.totalPendingDays} dag(en) (${counter.pendingCount} aanvragen)`,
      counter.allVerplichtCount.toString(),
      counter.totalApprovedDays > 0 ? '🟢 Verplicht verlof opgenomen' : '⚪ Geen verplicht verlof'
    ];
  });

  // Write all 3 tabs in parallel / batchUpdate
  const batchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values:batchUpdate`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        valueInputOption: 'USER_ENTERED',
        data: [
          {
            range: `'Personeel & Schemas'!A2:H${Math.max(staffRows.length + 1, 25)}`,
            values: staffRows.length > 0 ? staffRows : [['Geen personeel geconfigureerd']]
          },
          {
            range: `'Verlofaanvragen'!A2:I${Math.max(requestRows.length + 1, 50)}`,
            values: requestRows.length > 0 ? requestRows : [['Geen verlofaanvragen']]
          },
          {
            range: `'Verplicht Verlof Teller'!A2:G${Math.max(compulsoryRows.length + 1, 20)}`,
            values: compulsoryRows.length > 0 ? compulsoryRows : [['Geen verpleegkundigen gevonden']]
          }
        ]
      })
    }
  );

  if (!batchRes.ok) {
    const errText = await batchRes.text();
    throw new Error(`Fout bij wegschrijven verlofplanning naar Google Sheets: ${errText}`);
  }

  return {
    spreadsheetId,
    spreadsheetUrl: sheetMeta.url,
    timestamp: now
  };
};
