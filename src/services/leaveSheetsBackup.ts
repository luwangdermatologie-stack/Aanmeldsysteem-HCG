/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { StaffMember, LeaveRequest, LeaveSlot, LeaveType, LeaveStatus } from '../types';
import { calculateCompulsoryLeaveCounter, getStaffWeeklyScheduledSlots } from './leaveService';

export const getDutchWeekdayName = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return '-';
  const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
  const days = ['Zondag', 'Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag'];
  return days[d.getDay()] || '-';
};

export const formatDutchDate = (dateStr: string): string => {
  if (!dateStr) return '-';
  const parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
};

/**
 * Get or create Google Spreadsheet for Leave Planning with chronological leave overview as primary tab
 */
export const getOrCreateLeaveSpreadsheet = async (
  token: string,
  existingId?: string
): Promise<{ id: string; url: string; leaveSheetTab: string }> => {
  let targetLeaveSheetTab = 'Geplande & Aangevraagde Verloven';

  if (existingId) {
    try {
      const checkRes = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${existingId}?fields=spreadsheetId,properties.title,sheets.properties`,
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );
      if (checkRes.ok) {
        const data = await checkRes.json();
        const existingTitles: string[] = (data.sheets || []).map((s: any) => s.properties?.title || '');
        
        if (existingTitles.includes('Geplande & Aangevraagde Verloven')) {
          targetLeaveSheetTab = 'Geplande & Aangevraagde Verloven';
        } else if (existingTitles.includes('Verlofaanvragen')) {
          targetLeaveSheetTab = 'Verlofaanvragen';
        } else {
          // Add primary tab if neither exists
          try {
            await fetch(`https://sheets.googleapis.com/v4/spreadsheets/${existingId}:batchUpdate`, {
              method: 'POST',
              headers: {
                Authorization: `Bearer ${token}`,
                'Content-Type': 'application/json'
              },
              body: JSON.stringify({
                requests: [
                  {
                    addSheet: {
                      properties: {
                        title: 'Geplande & Aangevraagde Verloven',
                        index: 0,
                        gridProperties: { frozenRowCount: 1 }
                      }
                    }
                  }
                ]
              })
            });
            targetLeaveSheetTab = 'Geplande & Aangevraagde Verloven';
          } catch {
            targetLeaveSheetTab = existingTitles[0] || 'Geplande & Aangevraagde Verloven';
          }
        }

        return {
          id: data.spreadsheetId,
          url: `https://docs.google.com/spreadsheets/d/${data.spreadsheetId}`,
          leaveSheetTab: targetLeaveSheetTab
        };
      }
    } catch (e) {
      console.warn('Kan bestaande verlof sheet niet verifiëren, nieuwe wordt gecreëerd:', e);
    }
  }

  // Create new spreadsheet where the chronological leave list is the very first tab (index 0)
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `DermatoMed - Verlofplanning Backup`
      },
      sheets: [
        {
          properties: {
            title: 'Geplande & Aangevraagde Verloven',
            gridProperties: { frozenRowCount: 1 }
          }
        },
        {
          properties: {
            title: 'Personeel & Schemas',
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
  const requestHeaders = [
    'Datum (JJJJ-MM-DD)',
    'Weekdag',
    'Datum (NL)',
    'Personeelslid',
    'Rol / Functie',
    'Dagdeel',
    'Dagen (Eenheden)',
    'Type Verlof',
    'Status',
    'Toelichting / Opmerking',
    'Aanvraagdatum',
    'Aanvraag ID'
  ];

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
            range: "'Geplande & Aangevraagde Verloven'!A1:L1",
            values: [requestHeaders]
          },
          {
            range: "'Personeel & Schemas'!A1:H1",
            values: [staffHeaders]
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
    url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}`,
    leaveSheetTab: 'Geplande & Aangevraagde Verloven'
  };
};

/**
 * Perform synchronization to Google Sheets with chronological leave records as the primary focus
 */
export const backupLeaveToGoogleSheets = async (
  token: string,
  staffList: StaffMember[],
  requests: LeaveRequest[],
  existingSpreadsheetId?: string
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; timestamp: string }> => {
  const sheetMeta = await getOrCreateLeaveSpreadsheet(token, existingSpreadsheetId);
  const spreadsheetId = sheetMeta.id;
  const leaveTab = sheetMeta.leaveSheetTab;
  const now = new Date().toISOString();

  // 1. Build Primary Tab: Geplande & Aangevraagde Verloven in STRIKT CHRONOLOGISCHE volgorde (Datum oplopend)
  // Filter voornamelijk gepland (goedgekeurd) en aangevraagd (in aanvraag / in wacht)
  const activeRequests = requests.filter(r => r.status !== 'afgekeurd');
  const sortedChronological = [...activeRequests].sort((a, b) => {
    const dDiff = (a.date || '').localeCompare(b.date || '');
    if (dDiff !== 0) return dDiff;
    const slotWeight: Record<string, number> = { 'HELE_DAG': 1, 'VM': 2, 'NM': 3 };
    const sDiff = (slotWeight[a.slot] || 4) - (slotWeight[b.slot] || 4);
    if (sDiff !== 0) return sDiff;
    return (a.staff_name || '').localeCompare(b.staff_name || '');
  });

  const requestHeaders = [
    'Datum (JJJJ-MM-DD)',
    'Weekdag',
    'Datum (NL)',
    'Personeelslid',
    'Rol / Functie',
    'Dagdeel',
    'Dagen (Eenheden)',
    'Type Verlof',
    'Status',
    'Toelichting / Opmerking',
    'Aanvraagdatum',
    'Aanvraag ID'
  ];

  const requestRows = sortedChronological.map(r => {
    const staff = staffList.find(s => s.id === r.staff_id);
    const staffName = r.staff_name || staff?.name || r.staff_id;
    const role = staff ? (staff.role === 'arts' ? 'Arts' : (staff.jobTitle || 'Verpleegkundige')) : '-';
    const weekday = getDutchWeekdayName(r.date);
    const nlDate = formatDutchDate(r.date);
    const slotLabel = r.slot === 'HELE_DAG' ? 'Hele dag' : r.slot === 'VM' ? 'Voormiddag (VM)' : 'Namiddag (NM)';
    const units = r.units !== undefined ? r.units.toString() : (r.slot === 'HELE_DAG' ? '1.0' : '0.5');
    const typeLabel = r.type === 'feestdag' ? 'Wettelijke Feestdag' : r.type === 'gecompenseerd' ? 'Gecompenseerde Werkdag' : r.type === 'verplicht' ? 'Verplicht Verlof' : 'Regulier Verlof';
    const statusLabel = r.status === 'goedgekeurd'
      ? 'Goedgekeurd (Gepland)'
      : r.status === 'aangevraagd'
      ? 'In Aanvraag'
      : r.status === 'on_hold'
      ? 'In Wacht'
      : 'Geweigerd';

    return [
      r.date,
      weekday,
      nlDate,
      staffName,
      role,
      slotLabel,
      units,
      typeLabel,
      statusLabel,
      r.note || '',
      r.created_at ? new Date(r.created_at).toLocaleString('nl-BE') : '',
      r.id
    ];
  });

  // 2. Build Tab: Personeel & Schemas
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
      member.role === 'arts' ? 'Arts' : (member.jobTitle || 'Verpleegkundige'),
      formatDay('maandag'),
      formatDay('dinsdag'),
      formatDay('woensdag'),
      formatDay('donderdag'),
      formatDay('vrijdag'),
      `${getStaffWeeklyScheduledSlots(member.schedule)} / 10 dagdelen`
    ];
  });

  // 3. Build Tab: Verplicht Verlof Teller (enkel verpleegkundigen)
  const nurses = staffList.filter(s => s.role === 'verpleegkundige');
  const compulsoryRows = nurses.map(nurse => {
    const counter = calculateCompulsoryLeaveCounter(nurse.id, requests);
    return [
      nurse.name,
      nurse.jobTitle || 'Verpleegkundige',
      `${counter.totalApprovedDays} dag(en)`,
      `${counter.totalApprovedHalfDays} halve dagen`,
      `${counter.totalPendingDays} dag(en) (${counter.pendingCount} aanvragen)`,
      counter.allVerplichtCount.toString(),
      counter.totalApprovedDays > 0 ? '🟢 Verplicht verlof opgenomen' : '⚪ Geen verplicht verlof'
    ];
  });

  // Clear previous data range in leave tab to prevent phantom ghost rows
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/'${leaveTab}'!A2:L1000:clear`,
    {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` }
    }
  ).catch(() => {});

  // Write all tabs
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
            range: `'${leaveTab}'!A1:L1`,
            values: [requestHeaders]
          },
          {
            range: `'${leaveTab}'!A2:L${Math.max(requestRows.length + 1, 2)}`,
            values: requestRows.length > 0 ? requestRows : [['Geen geplande of aangevraagde verloven gevonden']]
          },
          {
            range: `'Personeel & Schemas'!A2:H${Math.max(staffRows.length + 1, 2)}`,
            values: staffRows.length > 0 ? staffRows : [['Geen personeel geconfigureerd']]
          },
          {
            range: `'Verplicht Verlof Teller'!A2:G${Math.max(compulsoryRows.length + 1, 2)}`,
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

/**
 * Generate CSV string formatted specifically for Microsoft Excel (UTF-8 BOM + semicolon delimiters)
 */
export const generateLeaveCsvContent = (
  staffList: StaffMember[],
  requests: LeaveRequest[]
): string => {
  const activeRequests = requests.filter(r => r.status !== 'afgekeurd');
  const sorted = [...activeRequests].sort((a, b) => {
    const dDiff = (a.date || '').localeCompare(b.date || '');
    if (dDiff !== 0) return dDiff;
    const slotWeight: Record<string, number> = { 'HELE_DAG': 1, 'VM': 2, 'NM': 3 };
    const sDiff = (slotWeight[a.slot] || 4) - (slotWeight[b.slot] || 4);
    if (sDiff !== 0) return sDiff;
    return (a.staff_name || '').localeCompare(b.staff_name || '');
  });

  const headers = [
    'Datum (JJJJ-MM-DD)',
    'Weekdag',
    'Datum (NL)',
    'Personeelslid',
    'Rol / Functie',
    'Dagdeel',
    'Dagen (Eenheden)',
    'Type Verlof',
    'Status',
    'Toelichting / Opmerking',
    'Aanvraagdatum'
  ];

  const escapeCsv = (val: string | number | undefined | null) => {
    if (val === undefined || val === null) return '""';
    const str = val.toString().replace(/"/g, '""');
    return `"${str}"`;
  };

  const rows = sorted.map(r => {
    const staff = staffList.find(s => s.id === r.staff_id);
    const staffName = r.staff_name || staff?.name || r.staff_id;
    const role = staff ? (staff.role === 'arts' ? 'Arts' : (staff.jobTitle || 'Verpleegkundige')) : '-';
    const weekday = getDutchWeekdayName(r.date);
    const nlDate = formatDutchDate(r.date);
    const slotLabel = r.slot === 'HELE_DAG' ? 'Hele dag' : r.slot === 'VM' ? 'Voormiddag (VM)' : 'Namiddag (NM)';
    const units = r.units !== undefined ? r.units.toString() : (r.slot === 'HELE_DAG' ? '1.0' : '0.5');
    const typeLabel = r.type === 'feestdag' ? 'Wettelijke Feestdag' : r.type === 'gecompenseerd' ? 'Gecompenseerde Werkdag' : r.type === 'verplicht' ? 'Verplicht Verlof' : 'Regulier Verlof';
    const statusLabel = r.status === 'goedgekeurd'
      ? 'Goedgekeurd (Gepland)'
      : r.status === 'aangevraagd'
      ? 'In Aanvraag'
      : r.status === 'on_hold'
      ? 'In Wacht'
      : 'Geweigerd';

    return [
      escapeCsv(r.date),
      escapeCsv(weekday),
      escapeCsv(nlDate),
      escapeCsv(staffName),
      escapeCsv(role),
      escapeCsv(slotLabel),
      escapeCsv(units),
      escapeCsv(typeLabel),
      escapeCsv(statusLabel),
      escapeCsv(r.note || ''),
      escapeCsv(r.created_at ? new Date(r.created_at).toLocaleString('nl-BE') : '')
    ].join(';');
  });

  // UTF-8 BOM (\uFEFF) ensures Excel opens special characters correctly and respects column separation
  return '\uFEFF' + [headers.map(escapeCsv).join(';'), ...rows].join('\r\n');
};

/**
 * Instant client-side download of the chronological leave list as an Excel CSV file
 */
export const downloadLeaveCsv = (
  staffList: StaffMember[],
  requests: LeaveRequest[]
) => {
  const csv = generateLeaveCsvContent(staffList, requests);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  const dateStr = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `Verlofplanning_Chronologisch_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

/**
 * Restore leave requests from Google Sheets backup document ('Geplande & Aangevraagde Verloven' tab)
 */
export const restoreLeaveRequestsFromGoogleSheets = async (
  token: string,
  spreadsheetId: string,
  staffList: StaffMember[] = []
): Promise<{ restoredRequests: LeaveRequest[]; count: number }> => {
  if (!spreadsheetId || !spreadsheetId.trim()) {
    throw new Error('Geen geldig Google Sheets document ID opgegeven.');
  }

  // 1. Detect sheets tab
  let targetTab = 'Geplande & Aangevraagde Verloven';
  try {
    const metaRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.trim()}?fields=sheets.properties.title`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (metaRes.ok) {
      const meta = await metaRes.json();
      const titles = (meta.sheets || []).map((s: any) => s?.properties?.title);
      if (titles.includes('Geplande & Aangevraagde Verloven')) {
        targetTab = 'Geplande & Aangevraagde Verloven';
      } else if (titles.includes('Verlofaanvragen')) {
        targetTab = 'Verlofaanvragen';
      } else if (titles.length > 0) {
        targetTab = titles[0];
      }
    }
  } catch (e) {
    console.warn('Could not inspect leave sheet tabs:', e);
  }

  // 2. Fetch rows
  const fetchRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId.trim()}/values/${encodeURIComponent(targetTab)}!A2:L5000`,
    { headers: { Authorization: `Bearer ${token}` } }
  );

  if (!fetchRes.ok) {
    const errText = await fetchRes.text();
    throw new Error(`Kan gegevens niet ophalen uit Google Sheet (${fetchRes.status}): ${errText}`);
  }

  const data = await fetchRes.json();
  const rows: string[][] = data.values || [];

  if (rows.length === 0) {
    throw new Error('Geen verlofrijen gevonden in het geselecteerde Google Sheets document.');
  }

  const restoredRequests: LeaveRequest[] = [];
  const seenIds = new Set<string>();

  rows.forEach((row, index) => {
    // Format: [Datum (JJJJ-MM-DD), Weekdag, Datum NL, Personeelslid, Rol, Dagdeel, Dagen, Type, Status, Toelichting, Aanvraagdatum, ID]
    if (!row || row.length < 4) return;
    const rawDate = row[0]?.trim();
    const staffName = row[3]?.trim();
    if (!rawDate || !staffName || staffName === 'Personeelslid') return;

    // Check date YYYY-MM-DD
    let date = rawDate;
    if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(rawDate)) {
      const [d, m, y] = rawDate.split('/');
      date = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }

    const rawSlot = (row[5] || '').toUpperCase();
    let slot: LeaveSlot = 'HELE_DAG';
    if (rawSlot.includes('VM') || rawSlot.includes('VOORMIDDAG')) {
      slot = 'VM';
    } else if (rawSlot.includes('NM') || rawSlot.includes('NAMIDDAG')) {
      slot = 'NM';
    }

    const units = parseFloat(row[6]) || (slot === 'HELE_DAG' ? 1.0 : 0.5);
    const rawType = (row[7] || '').toLowerCase();
    const type: LeaveType = rawType.includes('feestdag') ? 'feestdag' : rawType.includes('gecompenseerd') ? 'gecompenseerd' : rawType.includes('verplicht') ? 'verplicht' : 'regulier';

    const rawStatus = (row[8] || '').toLowerCase();
    let status: LeaveStatus = 'aangevraagd';
    if (rawStatus.includes('goedgekeurd') || rawStatus.includes('gepland')) {
      status = 'goedgekeurd';
    } else if (rawStatus.includes('wacht')) {
      status = 'on_hold';
    } else if (rawStatus.includes('geweigerd') || rawStatus.includes('afgekeurd')) {
      status = 'afgekeurd';
    }

    const note = row[9]?.trim() || '';
    const rawCreated = row[10]?.trim();
    const createdAt = rawCreated ? new Date(rawCreated).toISOString() : new Date().toISOString();

    let id = row[11]?.trim();
    if (!id || seenIds.has(id)) {
      id = `req-${Date.now()}-${index}`;
    }
    seenIds.add(id);

    const matchedStaff = staffList.find(s => s.name.trim().toLowerCase() === staffName.toLowerCase());
    const staffId = matchedStaff ? matchedStaff.id : `staff-${staffName.toLowerCase().replace(/\s+/g, '-')}`;

    restoredRequests.push({
      id,
      staff_id: staffId,
      staff_name: staffName,
      date,
      slot,
      units,
      type,
      status,
      note,
      created_at: createdAt
    });
  });

  if (restoredRequests.length === 0) {
    throw new Error('Er konden geen geldige verlofaanvragen worden gelezen uit de rijen.');
  }

  return {
    restoredRequests,
    count: restoredRequests.length
  };
};

