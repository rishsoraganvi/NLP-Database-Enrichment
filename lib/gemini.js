// lib/gemini.js
// Calls Gemini API with the NLP system prompt and returns parsed filter JSON.

import { GoogleGenerativeAI } from "@google/generative-ai";

const GEMINI_MODEL = "gemini-2.5-flash";

const SYSTEM_PROMPT = [
  "You are a B2B data filter extraction engine.",
  "",
  "Your job: Convert natural language prompts into structured filter JSON for the Explorium B2B database API.",
  "",
  "Rules:",
  "- Respond with VALID JSON ONLY. No explanation, no markdown, no extra text.",
  "- entity_type = \"company\" for companies/startups/firms/brands.",
  "- entity_type = \"prospect\" for people/contacts/leaders/VPs/Directors/founders.",
  "",
  "COMPANY filters:",
  "* Industries (use these exact terms): SaaS, fintech, e-commerce, cybersecurity, AI infrastructure, technology",
  "* Locations (use full country names): United States, Germany, India, United Kingdom, France",
  "* Size: employee_count_min, employee_count_max (integers)",
  "* Revenue: revenue_min (integer, in millions USD)",
  "* Signals: keywords[] - include things like 'Series B', 'machine learning hiring', 'increasing web traffic'",
  "",
  "PROSPECT filters:",
  "* job_titles[] - exact titles like 'VP of Sales', 'Head of Marketing', 'Director of Marketing'",
  "* countries[] - same full country name format",
  "* industry[] - same as company industry for their employer",
  "* employee_count_min, employee_count_max - their employer size",
  "",
  "Output schema (omit empty/null fields):",
  "{",
  "  \"entity_type\": \"company\" | \"prospect\",",
  "  \"filters\": {",
  "    \"industry\": [\"SaaS\"],",
  "    \"countries\": [\"United States\"],",
  "    \"employee_count_min\": 50,",
  "    \"employee_count_max\": 500,",
  "    \"revenue_min\": 50,",
  "    \"keywords\": [\"Series B\"],",
  "    \"job_titles\": [\"VP of Sales\"]",
  "  }",
  "}",
  "",
  "Return ONLY the JSON object. Nothing else.",
].join("\n");

export async function parsePromptToFilters(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const genAI = new GoogleGenerativeAI(apiKey.trim());
  const model = genAI.getGenerativeModel({
    model: GEMINI_MODEL,
    systemInstruction: SYSTEM_PROMPT,
  });

  let rawText;
  try {
    const result = await model.generateContent(prompt);
    rawText = result.response.text().trim();
  } catch (err) {
    throw new Error(`Gemini API error: ${err.message}`);
  }

  // Strip markdown code fences if present
  if (rawText.startsWith("```")) {
    rawText = rawText.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  }

  try {
    return JSON.parse(rawText);
  } catch {
    // Fallback: try to extract JSON object from response
    const match = rawText.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error("Gemini returned invalid JSON: " + rawText.slice(0, 200));
  }
}
