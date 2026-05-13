import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN;

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // API Route for LinkedIn Extraction via Apify
  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url) {
      return res.status(400).json({ error: "URL is required" });
    }

    if (!APIFY_API_TOKEN) {
      return res.status(500).json({ error: "APIFY_API_TOKEN is not configured in the server" });
    }

    try {
      // Trigger Apify LinkedIn Scraper
      // Using a common scraper ID: "voyager~linkedin-profile-scraper" or similar
      // For general purpose, "mikkis~linkedin-profile-scraper" or "canadesk~linkedin-scraper"
      // Reference: https://apify.com/mikkis/linkedin-profile-scraper
      
      const SCRAPER_ID = "mikkis/linkedin-profile-scraper"; 
      
      const runResponse = await axios.post(
        `https://api.apify.com/v2/acts/${SCRAPER_ID}/runs?token=${APIFY_API_TOKEN}`,
        {
          urls: [url],
          limitPerSource: 1,
        }
      );

      const runId = runResponse.data.data.id;
      const datasetId = runResponse.data.data.defaultDatasetId;

      // Poll for completion (simplified for this context, ideally use webhooks or longer timeout)
      // In a real app, this might take 30-60 seconds.
      // We'll wait a bit then fetch. For UI experience, we'll wait up to 120s.
      
      let status = "RUNNING";
      let attempts = 0;
      const maxAttempts = 20; // 20 * 5s = 100s

      while (status !== "SUCCEEDED" && attempts < maxAttempts) {
        await new Promise(r => setTimeout(r, 5000));
        const statusCheck = await axios.get(
          `https://api.apify.com/v2/actor-runs/${runId}?token=${APIFY_API_TOKEN}`
        );
        status = statusCheck.data.data.status;
        attempts++;
      }

      if (status !== "SUCCEEDED") {
        return res.status(504).json({ error: "Extraction timed out" });
      }

      // Fetch results
      const datasetResponse = await axios.get(
        `https://api.apify.com/v2/datasets/${datasetId}/items?token=${APIFY_API_TOKEN}`
      );

      const profile = datasetResponse.data[0];
      if (!profile) {
        return res.status(404).json({ error: "Profile not found or inaccessible" });
      }

      res.json(profile);
    } catch (error: any) {
      console.error("Apify error:", error.response?.data || error.message);
      res.status(500).json({ error: "Failed to extract data via Apify" });
    }
  });

  // Vite middleware for development
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
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
