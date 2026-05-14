import { GoogleGenAI, Type } from "@google/genai";
import { preferCommaOverLongDash } from "../lib/messageFormat";

export interface ProfileData {
  url: string;
  name?: string;
  headline?: string;
  company?: string;
  about?: string;
  experience?: string;
  industry?: string;
  personalWebsite?: string;
  companyWebsite?: string;
}

/** How profile fields were obtained before Gemini formatted outreach copy. */
export type ProfileDataSource = 'apify_scrape' | 'gemini_recon';

/** One outreach angle (Gemini returns six per profile). */
export interface MessageVariation {
  label: string;
  connectionRequest: string;
  firstDM: string;
  icebreakerAngle: string;
}

export interface OutreachContent extends ProfileData {
  connectionRequest: string;
  firstDM: string;
  icebreakerAngle: string;
  /** Six angle-specific variants when generated with the current schema; padded if the model returns fewer. */
  messageVariations?: MessageVariation[];
  /** Set after extraction: live Apify scrape vs Gemini URL/search fallback. Omitted on older saved profiles. */
  dataSource?: ProfileDataSource;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

const VARIATION_COUNT = 6;

const OUTREACH_VARIATION_BLOCK = `
MESSAGING OUTPUT (required):
- Set "messageVariations" to an array of EXACTLY ${VARIATION_COUNT} objects, in this order. Each object MUST have: label (use EXACTLY the string shown for that index), connectionRequest (LinkedIn connection note, max 280 chars), firstDM (first message body), icebreakerAngle (one line: why this angle fits them).
- Required label strings in order (index 0 through 5): "Relational", "Recent post / About", "Experience", "Company", "Shared Founder-Builder Context", "Soft Permission / Low Pressure".
- Intent by index (match copy to the label):
  (0) Relational: warm, peer-to-peer, relationship-first, no hard pitch.
  (1) Recent post / About: If scraped or inferred data includes a LinkedIn post or activity with a date within the last 7 days, anchor the hook on that post. If there is no recent post in the data, anchor on their About section only. Do not invent a post date.
  (2) Experience: hook on a specific role, trajectory, or concrete detail from their experience section.
  (3) Company: hook on what their company does, mission, or product; stay factual to provided data.
  (4) Shared Founder-Builder Context: mutual builder or founder framing only when the profile supports it.
  (5) Soft Permission / Low Pressure: explicit permission to ignore, easy out, minimal ask.
- The six variants must differ materially in what they reference (not cosmetic rewrites).
- Do NOT use em dashes (Unicode 2014) or en dashes (2013) as sentence punctuation; use commas or periods instead.
- Set top-level connectionRequest, firstDM, and icebreakerAngle to DUPLICATE messageVariations[0] (primary) for backward compatibility.
`;

const DEFAULT_VARIATION_LABELS = [
  "Relational",
  "Recent post / About",
  "Experience",
  "Company",
  "Shared Founder-Builder Context",
  "Soft Permission / Low Pressure",
] as const;

function normalizeMessageVariations(parsed: Record<string, unknown>): MessageVariation[] {
  const top = {
    connectionRequest: preferCommaOverLongDash(String(parsed.connectionRequest ?? "")),
    firstDM: preferCommaOverLongDash(String(parsed.firstDM ?? "")),
    icebreakerAngle: preferCommaOverLongDash(String(parsed.icebreakerAngle ?? "")),
  };
  const raw = parsed.messageVariations;
  let list: MessageVariation[] = [];
  if (Array.isArray(raw)) {
    list = raw.map((item, i) => {
      const o = item as Record<string, unknown>;
      const canonical = DEFAULT_VARIATION_LABELS[i] ?? `Variant ${i + 1}`;
      return {
        label: canonical,
        connectionRequest: preferCommaOverLongDash(
          String(o?.connectionRequest ?? "").trim() || top.connectionRequest
        ),
        firstDM: preferCommaOverLongDash(String(o?.firstDM ?? "").trim() || top.firstDM),
        icebreakerAngle: preferCommaOverLongDash(
          String(o?.icebreakerAngle ?? "").trim() || top.icebreakerAngle
        ),
      };
    });
  }
  if (list.length === 0) {
    list.push({
      label: DEFAULT_VARIATION_LABELS[0],
      ...top,
    });
  }
  let i = list.length;
  const ref = () => list[list.length - 1]!;
  while (list.length < VARIATION_COUNT) {
    const r = ref();
    list.push({
      label: DEFAULT_VARIATION_LABELS[i] ?? `Option ${i + 1}`,
      connectionRequest: preferCommaOverLongDash(r.connectionRequest.slice(0, 280)),
      firstDM: preferCommaOverLongDash(r.firstDM),
      icebreakerAngle: preferCommaOverLongDash(r.icebreakerAngle),
    });
    i++;
  }
  return list.slice(0, VARIATION_COUNT);
}

const GEMINI_MODEL = "gemini-3-flash-preview";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

function isGeminiQuotaError(err: unknown): boolean {
  const e = err as { status?: number; message?: string };
  const msg = typeof e?.message === "string" ? e.message : "";
  return (
    e?.status === 429 ||
    msg.includes("429") ||
    msg.includes("RESOURCE_EXHAUSTED") ||
    msg.includes("quota")
  );
}

function getGeminiErrorMessage(err: unknown): string {
  const e = err as { message?: string; status?: number };
  if (e?.message) {
    try {
      const parsed = JSON.parse(e.message) as { error?: { message?: string } };
      const inner = parsed?.error?.message;
      if (inner) return inner.length > 280 ? inner.slice(0, 280) + "…" : inner;
    } catch {
      /* not JSON */
    }
    return e.message.length > 400 ? e.message.slice(0, 400) + "…" : e.message;
  }
  return e?.status ? `Request failed (${e.status})` : "Unknown error";
}

export function formatClientError(err: unknown): string {
  if (err instanceof Error) return err.message || "Error";
  if (typeof err === "object" && err !== null && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.length) return m.length > 500 ? m.slice(0, 500) + "…" : m;
  }
  return String(err);
}

async function extractProfileData(url: string) {
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      const detail = typeof error.detail === "string" ? error.detail : JSON.stringify(error.detail ?? "");
      throw new Error(
        [error.error || "Extraction failed", detail && detail !== "{}" ? detail : ""].filter(Boolean).join(" — ")
      );
    }
    
    return await response.json();
  } catch (error) {
    console.warn("Apify extraction failed, falling back to Gemini Recon:", error);
    return null;
  }
}

const messageVariationItemSchema = {
  type: Type.OBJECT,
  required: ["label", "connectionRequest", "firstDM", "icebreakerAngle"],
  properties: {
    label: { type: Type.STRING },
    connectionRequest: { type: Type.STRING },
    firstDM: { type: Type.STRING },
    icebreakerAngle: { type: Type.STRING },
  },
};

const responseSchemaConfig = {
  responseMimeType: "application/json" as const,
  responseSchema: {
    type: Type.OBJECT,
    required: [
      "name",
      "headline",
      "company",
      "about",
      "experience",
      "industry",
      "personalWebsite",
      "companyWebsite",
      "connectionRequest",
      "firstDM",
      "icebreakerAngle",
      "messageVariations",
    ],
    properties: {
      name: { type: Type.STRING },
      headline: { type: Type.STRING },
      company: { type: Type.STRING },
      about: { type: Type.STRING },
      experience: { type: Type.STRING },
      industry: { type: Type.STRING },
      personalWebsite: { type: Type.STRING },
      companyWebsite: { type: Type.STRING },
      connectionRequest: { type: Type.STRING },
      firstDM: { type: Type.STRING },
      icebreakerAngle: { type: Type.STRING },
      messageVariations: {
        type: Type.ARRAY,
        items: messageVariationItemSchema,
      },
    },
  },
};

export async function generateOutreach(url: string): Promise<OutreachContent> {
  const rawData = await extractProfileData(url);
  const dataSource: ProfileDataSource = rawData != null ? 'apify_scrape' : 'gemini_recon';

  if (!process.env.GEMINI_API_KEY?.trim()) {
    throw new Error(
      "GEMINI_API_KEY is missing. Add it to .env.local and restart the dev server (npm run dev)."
    );
  }

  const contentsReconWithTools = `
        Analyze the LinkedIn profile at this URL: ${url}
        Today's date (ISO, UTC) for post recency when snippets include dates: ${new Date().toISOString().slice(0, 10)}.
        
        RECONNAISSANCE PROTOCOL:
        1. Access the URL via urlContext.
        2. IF blocked by a login wall OR if the page is generic:
           - Extract the name/slug from the URL path (e.g., from /in/rohan-choudhary, get "Rohan Choudhary").
           - Perform a Google Search for "[Name] LinkedIn profile" and "[Name] current work".
           - Use the search snippets to gather Name, Title, and Company.
        3. VERIFY: Compare search results with the URL context to ensure you have the right person.
        4. NO HALLUCINATIONS: If you find zero reliable data, return "UNKNOWN_ENTITY".
        5. Extract: Name, Headline, Company, About, Experience.

        COMMUNICATION DNA (Follow strictly):
        - Tone: Peer-to-peer, conversational, founders-to-founder.
        - Style: Natural, human, uses casual fillers ("curious," "ah," "nice").
        - Opening Patterns: 
           * "Hey [Name], we've been connected for a while now but never got a chance to talk."
           * "Hi [Name], appreciate the connection."
           * "Hey [Name], I saw what you're building at [Company]..."
        - The Hook: Use the "first 5-8 seconds decide everything" rule or the "website becomes invisible internally" pattern.
        - CTA: ALWAYS low-pressure. "Happy to share what I'm seeing if useful" or "Want me to send it over?".
        - Avoid: "I would like to help you," "Our services," hard sales pitches, and em dash or en dash punctuation in outreach (use commas or periods).
      ` + OUTREACH_VARIATION_BLOCK;

  const contentsReconFallback = `
        LinkedIn profile URL: ${url}
        Today's date (ISO, UTC) for post recency when snippets include dates: ${new Date().toISOString().slice(0, 10)}.
        Web search and URL-fetch tools are NOT available in this request.

        INFERENCE RULES (conservative):
        1. Parse /in/USERNAME from the URL. Derive a plausible display name from USERNAME (replace hyphens with spaces, title case) only as a weak hint — mark uncertainty in "about" if you are guessing.
        2. Do NOT invent employers, schools, or achievements. Use "Unknown" or "Not available from URL alone" for headline, company, experience, industry when you have no evidence.
        3. Still produce connectionRequest and firstDM that are polite and generic enough to be safe if details are thin.

        COMMUNICATION DNA (Follow strictly):
        - Tone: Peer-to-peer, conversational, founders-to-founder.
        - Style: Natural, human, uses casual fillers ("curious," "ah," "nice").
        - Opening Patterns: 
           * "Hey [Name], we've been connected for a while now but never got a chance to talk."
           * "Hi [Name], appreciate the connection."
           * "Hey [Name], I saw what you're building at [Company]..."
        - The Hook: Use the "first 5-8 seconds decide everything" rule or the "website becomes invisible internally" pattern.
        - CTA: ALWAYS low-pressure. "Happy to share what I'm seeing if useful" or "Want me to send it over?".
        - Avoid: "I would like to help you," "Our services," hard sales pitches, and em dash or en dash punctuation in outreach (use commas or periods).
      ` + OUTREACH_VARIATION_BLOCK;

  try {
    let response;

    if (rawData) {
      const contentsFromScrape = `
        Analyze the following LinkedIn profile raw data:
        ${JSON.stringify(rawData, null, 2)}
        
        Original URL: ${url}
        Today's date (ISO, UTC) for judging whether a post is within the last 7 days: ${new Date().toISOString().slice(0, 10)}.

        Your task:
        1. Extract the most accurate details for: Name, Headline, Company, About, Experience.
        2. Generate a personalized outreach based on the person's REAL background from this data.

        COMMUNICATION DNA (Follow strictly):
        - Tone: Peer-to-peer, conversational, founders-to-founder.
        - Style: Natural, human, uses casual fillers ("curious," "ah," "nice").
        - Opening Patterns: 
           * "Hey [Name], we've been connected for a while now but never got a chance to talk."
           * "Hi [Name], appreciate the connection."
           * "Hey [Name], I saw what you're building at [Company]..."
        - The Hook: Use the "first 5-8 seconds decide everything" rule or the "website becomes invisible internally" pattern.
        - CTA: ALWAYS low-pressure. "Happy to share what I'm seeing if useful" or "Want me to send it over?".
        - Avoid: "I would like to help you," "Our services," hard sales pitches, and em dash or en dash punctuation in outreach (use commas or periods).
      ` + OUTREACH_VARIATION_BLOCK;
      // Do not use Google Search / URL context tools here, they burn a separate quota tier and
      // are unnecessary when Apify already returned profile JSON.
      response = await ai.models.generateContent({
        model: GEMINI_MODEL,
        contents: contentsFromScrape,
        config: responseSchemaConfig
      });
    } else {
      try {
        response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: contentsReconWithTools,
          config: {
            ...responseSchemaConfig,
            tools: [{ googleSearch: {} }, { urlContext: {} }]
          }
        });
      } catch (firstErr: unknown) {
        if (!isGeminiQuotaError(firstErr)) {
          throw new Error(getGeminiErrorMessage(firstErr));
        }
        console.warn(
          "Gemini grounding quota exceeded (429). Retrying recon without Google Search / URL context:",
          getGeminiErrorMessage(firstErr)
        );
        response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: contentsReconFallback,
          config: responseSchemaConfig
        });
      }
    }

    let text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const parsedData = JSON.parse(jsonStr);
    const p = parsedData as Record<string, unknown>;
    const messageVariations = normalizeMessageVariations(p);
    const primary = messageVariations[0]!;

    // Extract grounding sources
    const sources: Array<{title: string, uri: string}> = [];
    const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
    if (chunks) {
      chunks.forEach((chunk: any) => {
        if (chunk.web?.uri) {
          sources.push({
            title: chunk.web.title || "Web Source",
            uri: chunk.web.uri
          });
        }
      });
    }
    
    return {
      url,
      name: String(p.name ?? ""),
      headline: String(p.headline ?? ""),
      company: String(p.company ?? ""),
      about: String(p.about ?? ""),
      experience: String(p.experience ?? ""),
      industry: String(p.industry ?? ""),
      personalWebsite: String(p.personalWebsite ?? ""),
      companyWebsite: String(p.companyWebsite ?? ""),
      connectionRequest: primary.connectionRequest,
      firstDM: primary.firstDM,
      icebreakerAngle: primary.icebreakerAngle,
      messageVariations,
      dataSource,
      sources
    };
  } catch (error) {
    console.error("Error generating outreach:", error);
    throw error;
  }
}

export async function bulkGenerateOutreach(urls: string[], onProgress?: (index: number, total: number) => void): Promise<OutreachContent[]> {
  const total = urls.length;
  let completed = 0;

  // Process in batches of 3 to stay within search grounding rate limits while being fast
  const batchSize = 3;
  const results: OutreachContent[] = [];

  for (let i = 0; i < urls.length; i += batchSize) {
    const batch = urls.slice(i, i + batchSize);
    const batchPromises = batch.map(async (url) => {
      try {
        const result = await generateOutreach(url);
        completed++;
        if (onProgress) onProgress(completed, total);
        return result;
      } catch (err) {
        completed++;
        if (onProgress) onProgress(completed, total);
        console.error(`Failed to process URL: ${url}`, err);
        return null;
      }
    });

    const batchResults = await Promise.all(batchPromises);
    results.push(...(batchResults.filter(r => r !== null) as OutreachContent[]));
  }

  return results;
}
