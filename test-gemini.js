// Verify Gemini key works for generateContent
const { GoogleGenerativeAI } = require("@google/generative-ai");
const https = require("https");

const fs = require("fs");
const envFile = require("path").join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf8").split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const idx = trimmed.indexOf("=");
    if (idx === -1) return;
    process.env[trimmed.slice(0, idx).trim()] = trimmed.slice(idx + 1).trim();
  });
}

const key = process.env.GEMINI_API_KEY;
console.log("Key:", key ? key.slice(0, 15) + "..." : "MISSING");
if (!key) process.exit(1);

const genAI = new GoogleGenerativeAI(key);

// Try models in order of preference
const MODELS = ["gemini-2.5-flash", "gemini-2.0-flash", "gemini-1.5-flash", "gemini-pro"];

async function main() {
  for (const modelName of MODELS) {
    const model = genAI.getGenerativeModel({ model: modelName });
    try {
      const r = await model.generateContent('Reply with exactly this JSON and nothing else: {"entity_type":"company","filters":{"industry":["SaaS"],"countries":["US"]}}');
      const text = r.response.text().trim();
      console.log(`\n[OK] Model "${modelName}" works!`);
      console.log("Response:", text.slice(0, 200));
      console.log(`\nUpdate lib/gemini.js to use model: "${modelName}"`);
      return;
    } catch (e) {
      console.log(`[FAIL] ${modelName}: ${e.message.slice(0, 120)}`);
    }
  }
  console.log("\nAll models failed. Check API key permissions.");
}

main();
