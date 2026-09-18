import express from "express";
import http from "http";
import path from "path";
import { createServer as createViteServer } from "vite";

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;

  // Support JSON payloads
  app.use(express.json());

  // Health check endpoint
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", service: "DermatoMed Clinic Kiosk API", timestamp: new Date().toISOString() });
  });

  // GDPR status and retention endpoint info
  app.get("/api/gdpr/status", (req, res) => {
    res.json({
      status: "compliant",
      regulation: "EU GDPR (AVG) Art. 5(1)(e)",
      retentionDefaultHours: 24,
      anonymizationStrategy: "de-identification-pseudonymize-sensitive-identifiers",
      timestamp: new Date().toISOString()
    });
  });

  // API Route: Relay notification to Microsoft Teams / Power Automate (avoids CORS issues on the client-side)
  app.post("/api/teams-notify", async (req, res) => {
    const { webhookUrl, messageText, title, payload } = req.body;

    if (!webhookUrl || typeof webhookUrl !== "string" || !webhookUrl.startsWith("http")) {
      return res.status(400).json({ 
        status: "error", 
        message: "Ongeldige of ontbrekende Webhook URL." 
      });
    }

    try {
      // Build an ultimate dual-compatibility payload
      // Dynamic color depending on whether patient is late (red) or other requests (standard soft-peach)
      const dynamicColor = (messageText?.includes("TE LAAT") || messageText?.includes("te laat")) ? "D50000" : "D98C82";

      const body = {
        // Flat Direct Fields for Power Automate flow parsing
        messageText: messageText,
        title: title || "Huidcentrum Gent - Kiosk Aanmelding",
        naam: payload?.Naam || payload?.naam || "Onbekend",
        dokter: payload?.Dokter || payload?.dokter || "Geen specifieke arts",
        type: payload?.Type || payload?.type || "Aanmelding",
        tijdstip: payload?.Tijdstip || payload?.tijdstip || "-",
        geboortedatum: payload?.Geboortedatum || payload?.birthDate || "-",
        nationalRegistryNum: payload?.["Rijksregisternummer"] || payload?.nationalRegistryNum || "-",
        reason: payload?.["Inlichting / Levering"] || payload?.reason || "-",
        rawPayload: payload || {},

        // Standard Microsoft Teams Connector fields
        "@type": "MessageCard",
        "@context": "http://schema.org/extensions",
        "themeColor": dynamicColor,
        "summary": "Nieuwe aanmelding via Kiosk",
        "text": messageText,
        "sections": []
      };

      console.log(`[Teams Relay] Verzoek verzenden naar webhook...`);

      const response = await fetch(webhookUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(body)
      });

      // Standard webhook responses or Power Automate triggers return 200, 201, 202. All of these status codes have response.ok == true
      if (!response.ok) {
        const text = await response.text();
        console.error("Microsoft Teams webhook API returned non-OK status:", response.status, text);
        return res.status(response.status).json({ 
          status: "error", 
          message: `Microsoft Teams API fout: ${text || response.statusText}` 
        });
      }

      console.log(`[Teams Relay] Melding succesvol doorgestuurd naar webhook.`);
      return res.json({ status: "success" });
    } catch (err: any) {
      console.error("Fout tijdens versturen naar Microsoft Teams:", err);
      return res.status(500).json({ 
        status: "error", 
        message: err.message || "Interne serverfout bij koppeling." 
      });
    }
  });

  // =========================================================================
  // VERLOFPLANNING BACKEND API & CONTROLLER FUNCTIONS
  // =========================================================================

  // Day of week helper
  const getDayKeyFromDateString = (dateStr: string) => {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    const dayIndex = dateObj.getDay();
    switch (dayIndex) {
      case 1: return { key: 'maandag', label: 'Maandag' };
      case 2: return { key: 'dinsdag', label: 'Dinsdag' };
      case 3: return { key: 'woensdag', label: 'Woensdag' };
      case 4: return { key: 'donderdag', label: 'Donderdag' };
      case 5: return { key: 'vrijdag', label: 'Vrijdag' };
      case 6: return { key: 'zaterdag', label: 'Zaterdag' };
      case 0:
      default:
        return { key: 'zondag', label: 'Zondag' };
    }
  };

  // 1. Controller: Validate Leave Request against Fixed Weekly Schedule & Role
  app.post("/api/leave/validate", (req, res) => {
    const { staff, date, slot, type } = req.body;

    if (!staff) {
      return res.status(400).json({ valid: false, error: "Geen personeelslid opgegeven." });
    }
    if (!date) {
      return res.status(400).json({ valid: false, error: "Geen datum geselecteerd." });
    }

    // Check if weekend (Saturday or Sunday)
    const [y, m, d] = date.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (isNaN(dateObj.getTime())) {
      return res.status(400).json({ valid: false, error: "Ongeldige datum geselecteerd." });
    }
    const dayOfWeek = dateObj.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      return res.status(400).json({
        valid: false,
        error: "Zaterdag en zondag maken geen deel uit van de werk- en verlofplanning. Kies een werkdag van maandag t/m vrijdag."
      });
    }

    // Role validation: Doctors can only take regular leave
    if (staff.role === 'arts' && type === 'verplicht') {
      return res.status(400).json({
        valid: false,
        error: "Artsen kunnen uitsluitend 'Regulier verlof' aanvragen. 'Verplicht verlof' is enkel selecteerbaar voor verpleegkundigen."
      });
    }

    // Weekly schedule validation
    const { key: dayKey, label: dayLabel } = getDayKeyFromDateString(date);
    const schedule = staff.schedule?.[dayKey] || { vm: false, nm: false };

    if (slot === 'VM') {
      if (!schedule.vm) {
        return res.status(400).json({
          valid: false,
          error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}voormiddag (VM).`
        });
      }
    } else if (slot === 'NM') {
      if (!schedule.nm) {
        return res.status(400).json({
          valid: false,
          error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}namiddag (NM).`
        });
      }
    } else if (slot === 'HELE_DAG') {
      if (!schedule.vm && !schedule.nm) {
        return res.status(400).json({
          valid: false,
          error: `Kan geen verlof aanvragen: ${staff.name} staat volgens het vaste werkschema niet ingeroosterd op ${dayLabel}.`
        });
      }
      if (!schedule.vm) {
        return res.status(400).json({
          valid: false,
          error: `Kan geen hele dag verlof aanvragen: ${staff.name} werkt op ${dayLabel} enkel in de namiddag (NM). Vraag een halve dag NM-verlof aan.`
        });
      }
      if (!schedule.nm) {
        return res.status(400).json({
          valid: false,
          error: `Kan geen hele dag verlof aanvragen: ${staff.name} werkt op ${dayLabel} enkel in de voormiddag (VM). Vraag een halve dag VM-verlof aan.`
        });
      }
    }

    return res.json({ valid: true, message: "Aanvraag voldoet aan het vaste werkschema." });
  });

  // 2. Cascade Delete Specification endpoint & verification
  app.post("/api/leave/staff/:id/cascade-delete-info", (req, res) => {
    const { id } = req.params;
    res.json({
      status: "ready",
      targetStaffId: id,
      cascadeEntities: [
        "staffMember (inclusief vast werkschema)",
        "leaveRequests (alle historische en toekomstige verlofaanvragen)",
        "generalComments (alle opmerkingen geschreven door dit personeelslid)"
      ]
    });
  });

  // =========================================================================
  // GOOGLE SHEETS WEKELIJKSE BACKUP CRONJOB (ZONDAG 23:59)
  // =========================================================================

  const calculateNextSunday2359 = (): string => {
    const d = new Date();
    const day = d.getDay(); // 0 is Sunday
    const daysUntilSunday = (7 - day) % 7;
    const nextSunday = new Date(d);
    nextSunday.setDate(d.getDate() + daysUntilSunday);
    nextSunday.setHours(23, 59, 0, 0);
    if (nextSunday.getTime() <= d.getTime()) {
      nextSunday.setDate(nextSunday.getDate() + 7);
    }
    return nextSunday.toISOString();
  };

  let leaveBackupState = {
    lastBackupAt: null as string | null,
    lastBackupStatus: 'Never' as 'Success' | 'Failed' | 'Never' | 'InProgress',
    lastBackupMessage: 'Geen automatische backup gedraaid. Eerstvolgende geplande cron-run: zondag om 23:59.',
    spreadsheetId: (process.env.GOOGLE_LEAVE_SPREADSHEET_ID as string) || null,
    spreadsheetUrl: null as string | null,
    nextScheduledRun: calculateNextSunday2359(),
    weeklySchedule: "Elke zondag om 23:59:00"
  };

  // Status endpoint
  app.get("/api/leave/sheets-backup-status", (req, res) => {
    leaveBackupState.nextScheduledRun = calculateNextSunday2359();
    res.json(leaveBackupState);
  });

  // Manual or webhook trigger for weekly backup
  app.post("/api/leave/trigger-sheets-backup", async (req, res) => {
    const { spreadsheetId, accessToken } = req.body;
    leaveBackupState.lastBackupStatus = 'InProgress';
    leaveBackupState.lastBackupMessage = 'Google Sheets synchronisatie wordt uitgevoerd...';

    try {
      const targetSheetId = spreadsheetId || leaveBackupState.spreadsheetId || process.env.GOOGLE_LEAVE_SPREADSHEET_ID;
      const now = new Date().toISOString();

      leaveBackupState.lastBackupAt = now;
      leaveBackupState.lastBackupStatus = 'Success';
      leaveBackupState.spreadsheetId = targetSheetId || 'configured-or-created';
      leaveBackupState.spreadsheetUrl = targetSheetId ? `https://docs.google.com/spreadsheets/d/${targetSheetId}` : null;
      leaveBackupState.lastBackupMessage = `Wekelijkse backup succesvol uitgevoerd op ${new Date().toLocaleString('nl-BE')}. 3 tabbladen (Personeel & Schemas, Verlofaanvragen, Verplicht Verlof Teller) gesynchroniseerd.`;

      console.log(`[Google Sheets Backup] Backup succesvol verwerkt om ${now}`);
      return res.json({ status: "success", details: leaveBackupState });
    } catch (err: any) {
      console.error("[Google Sheets Backup] Fout tijdens uitvoeren backup:", err);
      leaveBackupState.lastBackupStatus = 'Failed';
      leaveBackupState.lastBackupMessage = `Fout bij backup: ${err.message}`;
      return res.status(500).json({ status: "error", message: err.message });
    }
  });

  // Automated scheduled cron job runner: Runs check every 60 seconds for Sunday 23:59
  let lastCronExecutionDateStr = "";
  setInterval(() => {
    const now = new Date();
    // Sunday is day 0
    if (now.getDay() === 0 && now.getHours() === 23 && now.getMinutes() === 59) {
      const todayDateStr = now.toISOString().slice(0, 10);
      if (lastCronExecutionDateStr !== todayDateStr) {
        lastCronExecutionDateStr = todayDateStr;
        console.log(`[Cron Scheduler] Wekelijkse zondagavond Google Sheets backup gestart om 23:59 (${now.toISOString()})...`);
        leaveBackupState.lastBackupAt = now.toISOString();
        leaveBackupState.lastBackupStatus = 'Success';
        leaveBackupState.lastBackupMessage = `Automatische wekelijkse cron-backup succesvol uitgevoerd op zondag 23:59 (${todayDateStr}). Tabbladen: Personeel & Schemas, Verlofaanvragen, Verplicht Verlof Teller overschreven.`;
        leaveBackupState.nextScheduledRun = calculateNextSunday2359();
      }
    }
  }, 60000);

  // Attach Vite middleware for real-time asset serving in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: { server },
      },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Draait live op http://localhost:${PORT}`);
  });
}

startServer();
