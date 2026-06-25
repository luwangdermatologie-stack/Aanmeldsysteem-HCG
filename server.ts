import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

async function startServer() {
  const app = express();
  app.set("trust proxy", 1);
  const PORT = 3000;

  // Use Helmet for security headers (HSTS, NoSniff, XSS protection, etc.)
  // We disable contentSecurityPolicy in dev mode to allow Vite to work seamlessly
  app.use(helmet({
    contentSecurityPolicy: process.env.NODE_ENV === "production" ? undefined : false,
  }));

  // Setup Rate Limiter to prevent brute-force and DDoS attacks
  const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // Limit each IP to 100 requests per `window` (here, per 15 minutes)
    standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
    legacyHeaders: false, // Disable the `X-RateLimit-*` headers
    message: { status: "error", message: "Too many requests from this IP, please try again after 15 minutes." }
  });

  // Apply the rate limiting middleware to API calls only
  app.use("/api/", apiLimiter);

  // Support JSON payloads
  app.use(express.json());

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

  // Attach Vite middleware for real-time asset serving in development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[Server] Draait live op http://localhost:${PORT}`);
  });
}

startServer();
