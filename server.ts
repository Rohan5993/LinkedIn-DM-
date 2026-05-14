import express from "express";
import path from "path";
import cors from "cors";
import axios from "axios";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();
dotenv.config({ path: path.join(process.cwd(), ".env.local"), override: true });

const APIFY_BASE = "https://api.apify.com/v2";

/**
 * Default store actor (human-readable `owner/name`).
 * Override with env `APIFY_LINKEDIN_ACTOR` if you use another scraper.
 */
const LINKEDIN_SCRAPER_ACTOR =
  process.env.APIFY_LINKEDIN_ACTOR?.trim() || "harvestapi/linkedin-profile-scraper";

/** Apify REST paths require `owner~actorName`, not `owner/actorName`. */
function apifyActorPathSegment(actorId: string): string {
  return actorId.replace("/", "~");
}

/** Actor-specific run input; see each actor's input schema on Apify. */
function buildLinkedinScraperRunInput(actorStoreId: string, profileUrl: string): Record<string, string[]> {
  const s = actorStoreId.toLowerCase();
  if (s.includes("crawlerbros")) {
    return { profileUrls: [profileUrl] };
  }
  // harvestapi/linkedin-profile-scraper and most others use `urls` (array of profile URLs).
  return { urls: [profileUrl] };
}

const TERMINAL_FAIL_STATUSES = ["FAILED", "ABORTED", "TIMED-OUT"] as const;

function getApifyToken(): string {
  return (process.env.APIFY_API_TOKEN || process.env.APIFY_TOKEN || "").trim();
}

function normalizeLinkedinProfileUrl(raw: string): string {
  const u = raw.trim();
  if (!u) return u;
  if (/^https?:\/\//i.test(u)) return u;
  if (/^(www\.)?linkedin\.com\//i.test(u)) return `https://${u}`;
  if (/^in\//i.test(u)) return `https://www.linkedin.com/${u}`;
  return `https://www.linkedin.com/in/${u.replace(/^\/+/, "")}`;
}

function formatApifyAxiosError(err: any): { message: string; detail?: unknown } {
  const data = err.response?.data;
  const msg =
    (typeof data === "object" && data !== null && "error" in data && (data as any).error?.message) ||
    (typeof data === "object" && data !== null && "message" in data && (data as any).message) ||
    err.message ||
    "Apify request failed";
  return { message: msg, detail: data };
}

function isTerminalFail(status: string): boolean {
  return (TERMINAL_FAIL_STATUSES as readonly string[]).includes(status);
}

/**
 * harvestapi/linkedin-profile-scraper returns nested fields (`firstName`, `currentPosition[]`, …).
 * Add `outreachHints` with flat strings so Gemini can map fields reliably (raw JSON is still included).
 */
function enrichDatasetItemForOutreach(item: Record<string, unknown>): Record<string, unknown> {
  const linkedinUrl = typeof item.linkedinUrl === "string" ? item.linkedinUrl : "";
  const harvestLike =
    linkedinUrl.includes("linkedin.com/in/") &&
    (typeof item.firstName === "string" ||
      typeof item.lastName === "string" ||
      typeof item.publicIdentifier === "string");

  if (!harvestLike) {
    return item;
  }

  const first = typeof item.firstName === "string" ? item.firstName : "";
  const last = typeof item.lastName === "string" ? item.lastName : "";
  let name = `${first} ${last}`.trim();
  if (!name && typeof item.publicIdentifier === "string") {
    name = item.publicIdentifier.replace(/-/g, " ");
  }

  const positions = Array.isArray(item.currentPosition) ? item.currentPosition : [];
  const primary = positions[0] as Record<string, unknown> | undefined;
  const company =
    primary && typeof primary.companyName === "string" ? primary.companyName : "";

  const websites = Array.isArray(item.websites)
    ? (item.websites as unknown[]).filter((w): w is string => typeof w === "string")
    : [];

  const experienceSummary =
    positions.length > 0
      ? positions
          .map((p) => {
            const x = p as Record<string, unknown>;
            return [x.position, x.companyName, x.duration]
              .filter((v) => typeof v === "string" && (v as string).length > 0)
              .join(" — ");
          })
          .join("\n")
      : "";

  return {
    ...item,
    outreachHints: {
      name,
      headline: typeof item.headline === "string" ? item.headline : "",
      company,
      about: typeof item.about === "string" ? item.about : "",
      industry: typeof item.industry === "string" ? item.industry : "",
      personalWebsite: websites[0] ?? "",
      companyWebsite:
        primary && typeof primary.companyLinkedinUrl === "string"
          ? primary.companyLinkedinUrl
          : "",
      linkedinUrl,
      experience: experienceSummary,
    },
  };
}

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT) || 3000;

  app.use(cors());
  app.use(express.json());

  app.post("/api/extract", async (req, res) => {
    const { url } = req.body;
    if (!url || typeof url !== "string") {
      return res.status(400).json({ error: "URL is required" });
    }

    const token = getApifyToken();
    if (!token) {
      return res.status(500).json({
        error:
          "Apify token missing. Set APIFY_API_TOKEN (or APIFY_TOKEN) in .env.local and restart npm run dev.",
      });
    }

    const profileUrl = normalizeLinkedinProfileUrl(url);
    const actorPath = apifyActorPathSegment(LINKEDIN_SCRAPER_ACTOR);

    /** Always pass token via params so special characters are encoded (avoid broken query strings). */
    const apifyAuth = { token };

    try {
      // waitForFinish max is 60s per Apify API docs; then we poll if still running.
      const runResponse = await axios.post(
        `${APIFY_BASE}/acts/${actorPath}/runs`,
        buildLinkedinScraperRunInput(LINKEDIN_SCRAPER_ACTOR, profileUrl),
        {
          params: { ...apifyAuth, waitForFinish: 60 },
          headers: { "Content-Type": "application/json" },
        }
      );

      const runId = runResponse.data?.data?.id;
      const datasetId = runResponse.data?.data?.defaultDatasetId;
      if (!runId || !datasetId) {
        console.error("Apify: unexpected start-run response", runResponse.data);
        return res.status(502).json({
          error: "Apify returned an unexpected response when starting the scraper",
        });
      }

      let status: string = runResponse.data?.data?.status ?? "RUNNING";
      let statusMessage: string | undefined = runResponse.data?.data?.statusMessage;
      let attempts = 0;
      const maxAttempts = 36; // up to ~3 min after first wait window

      if (isTerminalFail(status)) {
        return res.status(502).json({
          error: `Apify run ended with status: ${status}`,
          detail: runResponse.data?.data?.statusMessage,
        });
      }

      while (status !== "SUCCEEDED" && attempts < maxAttempts) {
        if (isTerminalFail(status)) {
          console.error("Apify run failed:", status, statusMessage);
          return res.status(502).json({
            error: `LinkedIn scrape failed (${status})`,
            detail: statusMessage || runResponse.data?.data,
          });
        }
        await new Promise((r) => setTimeout(r, 5000));
        const statusCheck = await axios.get(`${APIFY_BASE}/actor-runs/${runId}`, {
          params: apifyAuth,
        });
        status = statusCheck.data.data.status;
        statusMessage = statusCheck.data.data.statusMessage;
        attempts++;
      }

      if (status !== "SUCCEEDED") {
        return res.status(504).json({
          error: "Extraction timed out waiting for Apify",
          detail: { lastStatus: status, statusMessage },
        });
      }

      const datasetResponse = await axios.get(`${APIFY_BASE}/datasets/${datasetId}/items`, {
        params: { ...apifyAuth, clean: true },
      });

      const items = datasetResponse.data;
      const profile = Array.isArray(items) ? items[0] : null;
      if (!profile) {
        return res.status(404).json({
          error: "Profile not found or scraper returned no dataset rows",
        });
      }

      res.json(enrichDatasetItemForOutreach(profile as Record<string, unknown>));
    } catch (error: any) {
      const { message, detail } = formatApifyAxiosError(error);
      console.error("Apify error:", message, detail);
      const status = error.response?.status;
      const code = status === 401 || status === 403 ? 401 : 500;
      res.status(code).json({
        error: "Failed to extract data via Apify",
        detail: message,
        apifyBody: detail,
        hint:
          status === 404
            ? `Check actor id: use owner~name in the API (${actorPath}). Current actor: ${LINKEDIN_SCRAPER_ACTOR}`
            : undefined,
      });
    }
  });

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
    const t = getApifyToken();
    console.log(
      `Apify: ${t ? "token loaded" : "token MISSING"} | actor ${apifyActorPathSegment(LINKEDIN_SCRAPER_ACTOR)}`
    );
  });
}

startServer();
