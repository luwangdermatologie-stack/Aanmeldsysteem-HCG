/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  signInWithPopup,
  GoogleAuthProvider,
  onAuthStateChanged,
  User,
  signOut
} from 'firebase/auth';
import { auth } from '../firebase';
import { Timesheet, ActiveStaff } from '../types';

export const GOOGLE_WORKSPACE_SCOPES = [
  'https://www.googleapis.com/auth/spreadsheets',
  'https://www.googleapis.com/auth/drive.file'
];

const provider = new GoogleAuthProvider();
GOOGLE_WORKSPACE_SCOPES.forEach(scope => provider.addScope(scope));
provider.setCustomParameters({
  prompt: 'select_account'
});

// Flag to track sign-in in flight
let isSigningIn = false;
// Cached access token in memory (never written to localStorage)
let cachedAccessToken: string | null = null;

/**
 * Initialize auth listener to monitor Google session and token
 */
export const initGoogleAuth = (
  onSuccess: (user: User, token: string) => void,
  onFailure: () => void
) => {
  return onAuthStateChanged(auth, async (user: User | null) => {
    if (user && cachedAccessToken) {
      onSuccess(user, cachedAccessToken);
    } else if (!isSigningIn) {
      cachedAccessToken = null;
      onFailure();
    }
  });
};

/**
 * Trigger Google Sign In with Sheets & Drive scopes
 */
export const googleSignIn = async (): Promise<{ user: User; accessToken: string }> => {
  try {
    isSigningIn = true;
    const result = await signInWithPopup(auth, provider);
    const credential = GoogleAuthProvider.credentialFromResult(result);
    if (!credential?.accessToken) {
      throw new Error('Geen geldige Google OAuth access token ontvangen.');
    }
    cachedAccessToken = credential.accessToken;
    return { user: result.user, accessToken: cachedAccessToken };
  } catch (error: any) {
    console.error('Google Sign In error:', error);
    throw error;
  } finally {
    isSigningIn = false;
  }
};

/**
 * Get current cached access token
 */
export const getAccessToken = (): string | null => {
  return cachedAccessToken;
};

/**
 * Manually set or update cached access token
 */
export const setCachedAccessToken = (token: string | null) => {
  cachedAccessToken = token;
};

/**
 * Sign out of Google session
 */
export const googleLogout = async () => {
  await signOut(auth);
  cachedAccessToken = null;
};

/**
 * Calculate duration in hours and formatted string
 */
export const calculateTimesheetDuration = (clockIn?: string, clockOut?: string | null) => {
  if (!clockIn) return { hoursDecimal: 0, formatted: '-' };
  const inTime = new Date(clockIn).getTime();
  if (isNaN(inTime)) return { hoursDecimal: 0, formatted: '-' };

  const outTime = clockOut ? new Date(clockOut).getTime() : Date.now();
  if (isNaN(outTime) || outTime < inTime) return { hoursDecimal: 0, formatted: '-' };

  const diffMs = outTime - inTime;
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const hoursDecimal = Math.round((totalMinutes / 60) * 100) / 100;

  return {
    hoursDecimal,
    formatted: `${hours}u ${minutes}m`
  };
};

/**
 * Helper to format ISO timestamp to Belgian time HH:mm
 */
const formatTimeOnly = (iso?: string | null): string => {
  if (!iso) return '-';
  try {
    const d = new Date(iso);
    if (isNaN(d.getTime())) return '-';
    return d.toTimeString().slice(0, 5);
  } catch {
    return '-';
  }
};

/**
 * Create or verify existing Google Sheet for timesheet backups
 */
export const getOrCreateTimesheetSpreadsheet = async (
  token: string,
  existingId?: string
): Promise<{ id: string; url: string }> => {
  // If an existing ID is provided, verify it is still accessible
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
      console.warn('Kan bestaande sheet niet opvragen, nieuwe wordt aangemaakt', e);
    }
  }

  // Create new spreadsheet with dedicated history and summary tabs
  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      properties: {
        title: `DermatoMed - Personeel Tiktijden Historiek & Backup`
      },
      sheets: [
        {
          properties: {
            title: 'Historiek Tiktijden',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        },
        {
          properties: {
            title: 'Samenvatting per Medewerker',
            gridProperties: {
              frozenRowCount: 1
            }
          }
        }
      ]
    })
  });

  if (!createRes.ok) {
    const errText = await createRes.text();
    throw new Error(`Fout bij aanmaken Google Sheet: ${errText}`);
  }

  const createdData = await createRes.json();
  const spreadsheetId = createdData.spreadsheetId;

  // Initialize Header Rows
  const historyHeaders = [
    'Tiktijd ID',
    'Datum',
    'Medewerker',
    'Inklokken',
    'Uitklokken',
    'Duur (Uren decimaal)',
    'Gepresteerde Duur',
    'Status',
    'Laatst Gesynchroniseerd'
  ];

  const summaryHeaders = [
    'Medewerker ID',
    'Medewerker Naam',
    'Totaal Aantal Shifts',
    'Totale Gepresteerde Uren',
    'Laatste Actieve Werkdag',
    'Huidige Status'
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
            range: 'Historiek Tiktijden!A1:I1',
            values: [historyHeaders]
          },
          {
            range: 'Samenvatting per Medewerker!A1:F1',
            values: [summaryHeaders]
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
 * Backup and synchronize timesheets to Google Sheet, strictly preserving all historical entries.
 */
export const backupTimesheetsToGoogleSheets = async (
  token: string,
  timesheets: Timesheet[],
  staffList: ActiveStaff[],
  spreadsheetIdToUse?: string
): Promise<{
  spreadsheetId: string;
  spreadsheetUrl: string;
  count: number;
  timestamp: string;
}> => {
  // 1. Get or create the spreadsheet
  const sheetMeta = await getOrCreateTimesheetSpreadsheet(token, spreadsheetIdToUse);
  const spreadsheetId = sheetMeta.id;
  const nowIso = new Date().toISOString();
  const formattedSyncTime = new Date().toLocaleTimeString('nl-BE', {
    hour: '2-digit',
    minute: '2-digit',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
  });

  // 2. Fetch existing rows from 'Historiek Tiktijden' to preserve historical records
  let existingRows: string[][] = [];
  try {
    const fetchExistingRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Historiek%20Tiktijden!A2:I5000`,
      {
        headers: { Authorization: `Bearer ${token}` }
      }
    );
    if (fetchExistingRes.ok) {
      const data = await fetchExistingRes.json();
      if (Array.isArray(data.values)) {
        existingRows = data.values;
      }
    }
  } catch (err) {
    console.warn('Kon bestaande rijen niet ophalen, start met nieuwe update', err);
  }

  // 3. Build a map of existing records indexed by Timesheet ID (column A)
  // Row format: [ID, Datum, Medewerker, Inklokken, Uitklokken, Duur Dec, Duur Formaat, Status, Sync]
  const rowsById = new Map<string, string[]>();
  existingRows.forEach(row => {
    if (row[0]) {
      rowsById.set(row[0], row);
    }
  });

  // 4. Merge current local timesheets into the map
  timesheets.forEach(ts => {
    const duration = calculateTimesheetDuration(ts.clockIn, ts.clockOut);
    const inTime = formatTimeOnly(ts.clockIn);
    const outTime = ts.clockOut ? formatTimeOnly(ts.clockOut) : 'Nog ingeklokt';
    const status = ts.clockOut ? 'Voltooid' : 'Actief ingeklokt';

    const newRow = [
      ts.id,
      ts.date || '-',
      ts.staffName || 'Onbekend',
      inTime,
      outTime,
      duration.hoursDecimal.toString(),
      duration.formatted,
      status,
      formattedSyncTime
    ];

    rowsById.set(ts.id, newRow);
  });

  // 5. Convert map back to array and sort chronologically (newest dates first, or sorted by date & time)
  const combinedRows = Array.from(rowsById.values()).sort((a, b) => {
    const dateA = a[1] || '';
    const dateB = b[1] || '';
    if (dateA !== dateB) return dateB.localeCompare(dateA);
    const inA = a[3] || '';
    const inB = b[3] || '';
    return inB.localeCompare(inA);
  });

  // 6. Write all merged rows to 'Historiek Tiktijden'
  const historyWriteRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Historiek%20Tiktijden!A2:I${Math.max(
      combinedRows.length + 1,
      100
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: combinedRows
      })
    }
  );

  if (!historyWriteRes.ok) {
    const errText = await historyWriteRes.text();
    throw new Error(`Fout bij wegschrijven tiktijden historiek: ${errText}`);
  }

  // 7. Generate and update Summary per Staff member
  const staffSummaryMap = new Map<
    string,
    { name: string; shiftsCount: number; totalHours: number; lastDate: string; isCurrentlyIn: boolean }
  >();

  // Initialize with all staff
  staffList.forEach(s => {
    staffSummaryMap.set(s.id, {
      name: s.name,
      shiftsCount: 0,
      totalHours: 0,
      lastDate: '-',
      isCurrentlyIn: false
    });
  });

  // Aggregate across all historical and current records
  combinedRows.forEach(row => {
    const staffName = row[2];
    const date = row[1];
    const hours = parseFloat(row[5]) || 0;
    const isOut = row[7] === 'Voltooid';

    // Match staff
    const matchedStaff = staffList.find(s => s.name.toLowerCase() === staffName.toLowerCase());
    const key = matchedStaff ? matchedStaff.id : staffName;

    if (!staffSummaryMap.has(key)) {
      staffSummaryMap.set(key, {
        name: staffName,
        shiftsCount: 0,
        totalHours: 0,
        lastDate: '-',
        isCurrentlyIn: false
      });
    }

    const item = staffSummaryMap.get(key)!;
    item.shiftsCount += 1;
    item.totalHours = Math.round((item.totalHours + hours) * 100) / 100;
    if (item.lastDate === '-' || date > item.lastDate) {
      item.lastDate = date;
    }
    if (!isOut && date === new Date().toISOString().slice(0, 10)) {
      item.isCurrentlyIn = true;
    }
  });

  const summaryRows = Array.from(staffSummaryMap.entries()).map(([id, info]) => [
    id,
    info.name,
    info.shiftsCount.toString(),
    `${info.totalHours} uur`,
    info.lastDate,
    info.isCurrentlyIn ? '🟢 Momenteel Ingetikt' : '⚪ Uitgetikt'
  ]);

  // Update Summary Sheet
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/Samenvatting%20per%20Medewerker!A2:F${Math.max(
      summaryRows.length + 1,
      20
    )}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        values: summaryRows
      })
    }
  );

  return {
    spreadsheetId,
    spreadsheetUrl: sheetMeta.url,
    count: combinedRows.length,
    timestamp: nowIso
  };
};
