<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/68a9ca4b-ca65-426c-a226-72d88ad40b55

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Create [.env.local](.env.local) in the project root with:
   - **`GEMINI_API_KEY`** — required for outreach synthesis (injected into the client bundle via Vite).
   - **`APIFY_API_TOKEN`** (or **`APIFY_TOKEN`**) — required on the **server** for live LinkedIn profile scraping (set in the same `.env.local`; the Express server loads `.env` then `.env.local` with override so tokens match Vite). No spaces around `=`; restart the dev server after changes.
   - Optional: **`APIFY_LINKEDIN_ACTOR`** — defaults to `harvestapi/linkedin-profile-scraper` if unset (use `crawlerbros/linkedin-profile-scraper` for the alternate input shape).
3. Run the app:
   `npm run dev`

The dev server starts Express on port **3000** and serves the Vite app; the browser calls `POST /api/extract` on the same origin for scraping.

**Use `http://localhost:3000`** (not the default Vite-only port). If you open the app on another origin, `/api/extract` will fail and you will only get the unverified Gemini path.

### Troubleshooting

- **`GEMINI_API_KEY` missing in the browser:** Restart `npm run dev` after editing `.env.local` so Vite picks up the key.
- **Gemini “quota” / 429 with Google Search:** Search + URL tools use a stricter quota on free tiers. After a successful **Apify** scrape, the app calls Gemini **without** those tools. If Apify fails, the app tries tools once, then retries recon **without** tools so generation can still complete.

## Data pipeline and “real” profile data

| Step | What runs | What you get |
|------|------------|----------------|
| 1. Scrape | [Apify](https://apify.com) actor **`harvestapi/linkedin-profile-scraper`** (REST id `harvestapi~linkedin-profile-scraper`; see [`server.ts`](server.ts)). After each run, results are read from **`GET /v2/datasets/{defaultDatasetId}/items`** (same pattern as the [dataset items API](https://docs.apify.com/api/v2/dataset-items-get)) using your token from env, never hardcode a dataset URL with a token in the repo. | Structured JSON from a live public-profile scrape (subject to LinkedIn visibility, rate limits, and Apify pricing). |
| 2. Synthesis | **Google Gemini** (`gemini-3-flash-preview` in [`src/services/geminiService.ts`](src/services/geminiService.ts)) | Normalizes fields and writes **six** outreach variants (connection note + first DM + angle each), plus a primary copy for archive/export. If step 1 succeeds, the model is prompted with that JSON so outreach stays grounded in the scrape. |

**If Apify fails** (missing token, timeout, blocked profile, etc.), the app **still runs**: Gemini falls back to **Google Search + URL context** only. That path is labeled **Unverified** in the UI. Treat name, title, and company as needing human confirmation before you send anything.

**Bulk URLs:** Paste profile links in the textarea (with or without `https://`), or **upload a sheet** (CSV, TSV, TXT, or XLSX). Any column can contain URLs; duplicates across paste + file are merged. **Six message variants** (relational, recent post or about, experience, company, shared founder-builder, soft permission) appear as tabs on each result so you can pick an angle before copying.

**Older saved rows** in the archive may show **Provenance not recorded** (saved before this tagging existed).

## Optional: Supabase

Auth and cloud archive use Supabase env vars from the Vite client (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) when configured. Provenance is stored in **localStorage** with each profile; syncing `data_source` to Supabase would require adding a column and updating [`src/lib/supabase.ts`](src/lib/supabase.ts).
