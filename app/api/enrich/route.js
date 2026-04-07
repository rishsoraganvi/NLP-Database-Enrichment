// app/api/enrich/route.js
// POST /api/enrich — core pipeline: validate → Gemini → Explorium → respond

import { NextResponse } from "next/server";
import { parsePromptToFilters } from "@/lib/gemini";
import { searchExplorium } from "@/lib/explorium";
import { checkRateLimit } from "@/lib/limiter";

export async function POST(request) {
  // ── Rate limiting ──────────────────────────────────────────────────────────
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const rl = checkRateLimit(ip);
  if (!rl.allowed) {
    return NextResponse.json(
      { message: "Rate limit exceeded. Try again shortly.", error_code: "RATE_LIMITED" },
      { status: 429, headers: { "Retry-After": String(rl.retryAfter) } }
    );
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { message: "Invalid JSON body.", error_code: "BAD_REQUEST" },
      { status: 400 }
    );
  }

  const { prompt } = body;

  // ── Validate prompt ────────────────────────────────────────────────────────
  if (!prompt || typeof prompt !== "string" || prompt.trim().length === 0) {
    return NextResponse.json(
      { message: "Prompt is required and must be a non-empty string.", error_code: "INVALID_PROMPT" },
      { status: 400 }
    );
  }
  if (prompt.trim().length > 2000) {
    return NextResponse.json(
      { message: "Prompt too long (max 2000 characters).", error_code: "PROMPT_TOO_LONG" },
      { status: 400 }
    );
  }

  // ── Logging (never log secrets or prompt content) ──────────────────────────
  const logEntry = {
    timestamp: new Date().toISOString(),
    prompt_length: prompt.trim().length,
    ip,
  };

  // ── Gemini: parse prompt → structured filters ──────────────────────────────
  let parsed;
  try {
    parsed = await parsePromptToFilters(prompt.trim());
  } catch (err) {
    console.error("[enrich] Gemini error:", err.message, logEntry);
    return NextResponse.json(
      { message: "Failed to parse prompt with AI. Please rephrase.", error_code: "GEMINI_ERROR" },
      { status: 502 }
    );
  }

  const { entity_type, filters } = parsed;
  if (!entity_type || !["company", "prospect"].includes(entity_type)) {
    return NextResponse.json(
      { message: "Could not determine entity type from prompt.", error_code: "INVALID_ENTITY_TYPE" },
      { status: 422 }
    );
  }

  logEntry.entity_type = entity_type;

  // ── Explorium: fetch enriched data ─────────────────────────────────────────
  let results;
  try {
    results = await searchExplorium(entity_type, filters || {});
  } catch (err) {
    console.error("[enrich] Explorium error:", err.message, logEntry);

    if (err.message.includes("authentication")) {
      return NextResponse.json(
        { message: "Data provider authentication failed.", error_code: "EXPLORIUM_AUTH_ERROR" },
        { status: 502 }
      );
    }
    if (err.message.includes("quota")) {
      return NextResponse.json(
        { message: "Data provider quota exceeded. Please try again later.", error_code: "EXPLORIUM_QUOTA" },
        { status: 429 }
      );
    }
    return NextResponse.json(
      { message: "Failed to fetch enriched data. Please try again.", error_code: "EXPLORIUM_ERROR" },
      { status: 502 }
    );
  }

  logEntry.result_count = results.length;
  console.log("[enrich] OK", logEntry);

  return NextResponse.json({ results });
}
