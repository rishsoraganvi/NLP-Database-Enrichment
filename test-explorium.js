// Final Explorium probe with correct schema
const fs = require("fs");
const envFile = require("path").join(__dirname, ".env.local");
if (fs.existsSync(envFile)) {
  fs.readFileSync(envFile, "utf8").split("\n").forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const i = t.indexOf("="); if (i === -1) return;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  });
}
const key = process.env.EXPLORIUM_API_KEY;
console.log("Key:", key ? key.slice(0, 12) + "..." : "MISSING");

async function test(label, url, body) {
  console.log(`\n[${label}]`);
  const res = await fetch(url, {
    method: "POST",
    headers: { "api_key": key, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  console.log(`Status: ${res.status}`);
  try {
    const data = JSON.parse(text);
    const results = data.data || data.results || [];
    console.log(`Results: ${results.length}`);
    if (results[0]) console.log("First:", JSON.stringify(results[0]).slice(0, 300));
    else console.log("Full response:", text.slice(0, 400));
  } catch { console.log("Raw:", text.slice(0, 400)); }
}

(async () => {
  await test("businesses - SaaS US 51-200 employees",
    "https://api.explorium.ai/v1/businesses", {
    mode: "full", page: 1, page_size: 3, size: 3,
    filters: {
      country_code: { values: ["us"] },
      linkedin_category: { values: ["software development"] },
      company_size: { values: ["51-200"] },
    }
  });

  await test("businesses - empty filters",
    "https://api.explorium.ai/v1/businesses", {
    mode: "full", page: 1, page_size: 3, size: 3, filters: {}
  });
})();
