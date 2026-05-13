import { GoogleGenAI, Type } from "@google/genai";

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

export interface OutreachContent extends ProfileData {
  connectionRequest: string;
  firstDM: string;
  icebreakerAngle: string;
  sources?: Array<{
    title: string;
    uri: string;
  }>;
}

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

async function extractProfileData(url: string) {
  try {
    const response = await fetch('/api/extract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Extraction failed');
    }
    
    return await response.json();
  } catch (error) {
    console.warn("Apify extraction failed, falling back to Gemini Recon:", error);
    return null;
  }
}

export async function generateOutreach(url: string): Promise<OutreachContent> {
  const rawData = await extractProfileData(url);
  
  try {
    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: rawData ? `
        Analyze the following LinkedIn profile raw data:
        ${JSON.stringify(rawData, null, 2)}
        
        Original URL: ${url}

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
        - Avoid: "I would like to help you," "Our services," hard sales pitches.
      ` : `
        Analyze the LinkedIn profile at this URL: ${url}
        
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
        - Avoid: "I would like to help you," "Our services," hard sales pitches.
      `,

      config: {
        tools: [{ googleSearch: {} }, { urlContext: {} }],
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "headline", "company", "about", "experience", "industry", "personalWebsite", "companyWebsite", "connectionRequest", "firstDM", "icebreakerAngle"],
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
            icebreakerAngle: { type: Type.STRING }
          }
        }
      }
    });

    let text = response.text;
    if (!text) {
      throw new Error("No response text from Gemini");
    }

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : text;
    const parsedData = JSON.parse(jsonStr);

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
      ...parsedData,
      sources
    } as OutreachContent;
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
