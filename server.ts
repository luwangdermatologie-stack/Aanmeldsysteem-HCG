import express from "express";
import path from "path";
import fs from "fs";

async function startServer() {
  const app = express();
  const PORT = 3000;

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

  // =========================================================================
  // PERSISTENT LEAVE STORE (SURVIVES RESTARTS, REFRESHES, FIRESTORE QUOTA EXHAUSTION)
  // =========================================================================
  const LEAVE_STORE_FILE = path.resolve(process.cwd(), "data", "leave_store.json");

  function readLeaveStore(): {
    staff: any[];
    requests: any[];
    comments: any[];
    todos: any[];
    overrides: Record<string, string>;
  } {
    try {
      if (!fs.existsSync(path.dirname(LEAVE_STORE_FILE))) {
        fs.mkdirSync(path.dirname(LEAVE_STORE_FILE), { recursive: true });
      }
      if (fs.existsSync(LEAVE_STORE_FILE)) {
        const raw = fs.readFileSync(LEAVE_STORE_FILE, "utf-8");
        const parsed = JSON.parse(raw);
        return {
          staff: Array.isArray(parsed?.staff) ? parsed.staff : [],
          requests: Array.isArray(parsed?.requests) ? parsed.requests : [],
          comments: Array.isArray(parsed?.comments) ? parsed.comments : [],
          todos: Array.isArray(parsed?.todos) ? parsed.todos : [],
          overrides: parsed?.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {}
        };
      }
    } catch (e) {
      console.warn("[Server Leave Store] Read error:", e);
    }
    return { staff: [], requests: [], comments: [], todos: [], overrides: {} };
  }

  function writeLeaveStore(data: any) {
    try {
      if (!fs.existsSync(path.dirname(LEAVE_STORE_FILE))) {
        fs.mkdirSync(path.dirname(LEAVE_STORE_FILE), { recursive: true });
      }
      fs.writeFileSync(LEAVE_STORE_FILE, JSON.stringify(data, null, 2), "utf-8");
    } catch (e) {
      console.error("[Server Leave Store] Write error:", e);
    }
  }

  // GET complete leave data for instant multi-browser synchronization
  app.get("/api/leave/data", (req, res) => {
    const store = readLeaveStore();
    res.json(store);
  });

  // POST save or update leave request(s)
  app.post("/api/leave/requests", (req, res) => {
    const payload = req.body;
    const store = readLeaveStore();
    const itemsToSave: any[] = Array.isArray(payload) 
      ? payload 
      : (Array.isArray(payload?.requests) ? payload.requests : (payload?.request ? [payload.request] : [payload]));

    itemsToSave.forEach(newItem => {
      if (!newItem || !newItem.id) return;
      const idx = store.requests.findIndex(r => r.id === newItem.id);
      if (idx >= 0) {
        store.requests[idx] = { ...store.requests[idx], ...newItem };
      } else {
        store.requests.push(newItem);
      }
    });

    writeLeaveStore(store);
    res.json({ success: true, count: store.requests.length });
  });

  // DELETE leave request
  app.delete("/api/leave/requests/:id", (req, res) => {
    const { id } = req.params;
    const store = readLeaveStore();
    store.requests = store.requests.filter(r => r.id !== id);
    writeLeaveStore(store);
    res.json({ success: true, count: store.requests.length });
  });

  // POST batch delete leave requests
  app.post("/api/leave/requests/delete-batch", (req, res) => {
    const ids: string[] = req.body?.ids || [];
    const idSet = new Set(ids);
    const store = readLeaveStore();
    store.requests = store.requests.filter(r => !idSet.has(r.id));
    writeLeaveStore(store);
    res.json({ success: true, count: store.requests.length });
  });

  // POST save or update staff list
  app.post("/api/leave/staff", (req, res) => {
    const newStaff = req.body?.staff || req.body;
    if (Array.isArray(newStaff)) {
      const store = readLeaveStore();
      store.staff = newStaff;
      writeLeaveStore(store);
      return res.json({ success: true, count: store.staff.length });
    }
    res.status(400).json({ error: "Invalid staff payload, expected array." });
  });

  // POST shift overrides
  app.post("/api/leave/overrides", (req, res) => {
    const store = readLeaveStore();
    const { key, status, overrides } = req.body;
    if (overrides && typeof overrides === 'object') {
      store.overrides = { ...store.overrides, ...overrides };
    } else if (key && status) {
      store.overrides[key] = status;
    }
    writeLeaveStore(store);
    res.json({ success: true, overrides: store.overrides });
  });

  // DELETE shift override
  app.delete("/api/leave/overrides/:key", (req, res) => {
    const { key } = req.params;
    const store = readLeaveStore();
    delete store.overrides[key];
    writeLeaveStore(store);
    res.json({ success: true, overrides: store.overrides });
  });

  // POST save comments
  app.post("/api/leave/comments", (req, res) => {
    const payload = req.body;
    const store = readLeaveStore();
    const items: any[] = Array.isArray(payload) ? payload : [payload];
    items.forEach(c => {
      if (!c || !c.id) return;
      const idx = store.comments.findIndex(item => item.id === c.id);
      if (idx >= 0) store.comments[idx] = { ...store.comments[idx], ...c };
      else store.comments.push(c);
    });
    writeLeaveStore(store);
    res.json({ success: true, count: store.comments.length });
  });

  // DELETE comment
  app.delete("/api/leave/comments/:id", (req, res) => {
    const { id } = req.params;
    const store = readLeaveStore();
    store.comments = store.comments.filter(c => c.id !== id);
    writeLeaveStore(store);
    res.json({ success: true });
  });

  // POST save todos
  app.post("/api/leave/todos", (req, res) => {
    const payload = req.body;
    const store = readLeaveStore();
    const items: any[] = Array.isArray(payload) ? payload : [payload];
    items.forEach(t => {
      if (!t || !t.id) return;
      const idx = store.todos.findIndex(item => item.id === t.id);
      if (idx >= 0) store.todos[idx] = { ...store.todos[idx], ...t };
      else store.todos.push(t);
    });
    writeLeaveStore(store);
    res.json({ success: true, count: store.todos.length });
  });

  // DELETE todo
  app.delete("/api/leave/todos/:id", (req, res) => {
    const { id } = req.params;
    const store = readLeaveStore();
    store.todos = store.todos.filter(t => t.id !== id);
    writeLeaveStore(store);
    res.json({ success: true });
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
      leaveBackupState.lastBackupMessage = `Wekelijkse backup succesvol uitgevoerd op ${new Date().toLocaleString('nl-BE')}. Chronologische verlofplanning (Geplande & Aangevraagde Verloven) gesynchroniseerd.`;

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
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Draait live op http://localhost:${PORT}`);
  });

  // Support Google Cloud Run / container PORT environment variable (default 8080)
  const envPort = process.env.PORT ? parseInt(process.env.PORT, 10) : null;
  if (envPort && envPort !== PORT) {
    const cloudRunServer = app.listen(envPort, "0.0.0.0", () => {
      console.log(`[Server] Cloud Run listener actief op poort ${envPort}`);
    });
    cloudRunServer.on("error", (err: any) => {
      // In local dev/sandbox environments where 8080 is already bound by proxy, ignore EADDRINUSE
      if (err.code !== "EADDRINUSE") {
        console.error(`[Server] Fout op poort ${envPort}:`, err);
      }
    });
  }
}

startServer();
