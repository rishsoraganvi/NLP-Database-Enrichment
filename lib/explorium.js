// lib/explorium.js
// Calls Explorium API using the correct v1 schema and normalises results.
// Docs: https://developers.explorium.ai/reference/fetch_businesses

const EXPLORIUM_BASE = "https://api.explorium.ai/v1";
const MAX_RESULTS = 3;

function getHeaders() {
  const key = process.env.EXPLORIUM_API_KEY;
  if (!key) throw new Error("EXPLORIUM_API_KEY not configured");
  return {
    "api_key": key.trim(),
    "Content-Type": "application/json",
  };
}

/** Map company_size label (e.g. "51-200") from employee count range */
function employeeCountToSizeRange(min, max) {
  // Explorium company_size values: 1-10, 11-50, 51-200, 201-500, 501-1000, 1001-5000, 5001-10000, 10001+
  const ranges = ["1-10", "11-50", "51-200", "201-500", "501-1000", "1001-5000", "5001-10000", "10001+"];
  const boundaries = [10, 50, 200, 500, 1000, 5000, 10000, Infinity];

  const matched = [];
  for (let i = 0; i < boundaries.length; i++) {
    const rangeMax = boundaries[i];
    const rangeMin = i === 0 ? 1 : boundaries[i - 1] + 1;
    // Include range if it overlaps with [min, max]
    const lo = min ?? 0;
    const hi = max ?? Infinity;
    if (rangeMax >= lo && rangeMin <= hi) matched.push(ranges[i]);
  }
  return matched;
}

/** Map revenue_min (millions) to Explorium yearly_revenue_range values */
function revenueMinToRanges(revenueMin) {
  // Explorium values: 0-500K, 500K-1M, 1M-10M, 10M-50M, 50M-100M, 100M-250M, 250M-500M, 500M-1B, 1B-10B, 10B-100B
  const allRanges = ["0-500K", "500K-1M", "1M-10M", "10M-50M", "50M-100M", "100M-250M", "250M-500M", "500M-1B", "1B-10B", "10B-100B"];
  const minValues = [0, 0.5, 1, 10, 50, 100, 250, 500, 1000, 10000]; // in millions
  return allRanges.filter((_, i) => minValues[i] >= revenueMin || (i < allRanges.length - 1 && minValues[i + 1] > revenueMin));
}

/** Build Explorium businesses query payload from Gemini filter object */
function buildBusinessPayload(filters) {
  const exploFilters = {};

  // Country: Gemini gives full names, map to country codes
  const COUNTRY_MAP = {
    "united states": "us", "us": "us", "usa": "us",
    "united kingdom": "gb", "uk": "gb",
    "germany": "de", "france": "fr", "india": "in",
    "canada": "ca", "australia": "au", "israel": "il",
    "netherlands": "nl", "sweden": "se", "singapore": "sg",
  };
  if (filters.countries?.length) {
    const codes = filters.countries.map(c => COUNTRY_MAP[c.toLowerCase()] || c.toLowerCase()).filter(Boolean);
    if (codes.length) exploFilters.country_code = { values: codes };
  }

  // Industry → linkedin_category (SaaS maps to "software development" etc.)
  const INDUSTRY_MAP = {
    "saas": "software development",
    "software": "software development",
    "fintech": "financial services",
    "e-commerce": "retail",
    "ecommerce": "retail",
    "cybersecurity": "computer and network security",
    "ai infrastructure": "information technology and services",
    "technology": "information technology and services",
  };
  if (filters.industry?.length) {
    const cats = filters.industry.map(i => INDUSTRY_MAP[i.toLowerCase()] || i.toLowerCase());
    if (cats.length) exploFilters.linkedin_category = { values: cats };
  }

  // Employee count → company_size
  if (filters.employee_count_min != null || filters.employee_count_max != null) {
    const sizes = employeeCountToSizeRange(filters.employee_count_min, filters.employee_count_max);
    if (sizes.length) exploFilters.company_size = { values: sizes };
  }

  // Keywords → website_keywords
  const allKeywords = [...(filters.keywords || [])];
  if (filters.funding_stage?.length) allKeywords.push(...filters.funding_stage);
  if (allKeywords.length) {
    exploFilters.website_keywords = { values: allKeywords, operator: "OR" };
  }

  return {
    mode: "full",
    page: 1,
    page_size: MAX_RESULTS,
    size: MAX_RESULTS,
    filters: exploFilters,
  };
}

/** Build Explorium prospects query payload */
function buildProspectPayload(filters) {
  const exploFilters = {};

  const COUNTRY_MAP = {
    "united states": "us", "us": "us", "usa": "us",
    "united kingdom": "gb", "uk": "gb",
    "germany": "de", "france": "fr", "india": "in",
    "canada": "ca", "australia": "au",
    "europe": null, "european": null, "north america": null,
  };

  if (filters.countries?.length) {
    const codes = filters.countries
      .map(c => COUNTRY_MAP.hasOwnProperty(c.toLowerCase()) ? COUNTRY_MAP[c.toLowerCase()] : c.toLowerCase())
      .filter(Boolean);
    if (codes.length) {
      exploFilters.country_code = { values: codes };
      exploFilters.company_country_code = { values: codes };
    }
  }

  // Job title with semantic expansion
  if (filters.job_titles?.length) {
    exploFilters.job_title = {
      values: filters.job_titles,
      include_related_job_titles: true,
    };
  }

  // Map title keywords to job_level values
  const LEVEL_KW = {
    "vp": "vp", "vice president": "vp",
    "head": "director", "director": "director",
    "ceo": "cxo", "cfo": "cxo", "cto": "cxo", "coo": "cxo", "c-suite": "cxo",
    "manager": "manager", "owner": "owner", "founder": "founder",
  };
  const levels = new Set();
  (filters.job_titles || []).forEach(t => {
    const lower = t.toLowerCase();
    for (const [kw, level] of Object.entries(LEVEL_KW)) {
      if (lower.includes(kw)) levels.add(level);
    }
  });
  if (levels.size) exploFilters.job_level = { values: [...levels] };

  // Industry
  const INDUSTRY_MAP = {
    "saas": "software development", "software": "software development",
    "fintech": "financial services", "e-commerce": "retail", "ecommerce": "retail",
    "cybersecurity": "computer and network security",
  };
  if (filters.industry?.length) {
    const cats = filters.industry
      .map(i => INDUSTRY_MAP[i.toLowerCase()] || i.toLowerCase())
      .filter(Boolean);
    if (cats.length) exploFilters.linkedin_category = { values: cats };
  }

  // Employee count → company_size
  if (filters.employee_count_min != null || filters.employee_count_max != null) {
    const sizes = employeeCountToSizeRange(filters.employee_count_min, filters.employee_count_max);
    if (sizes.length) exploFilters.company_size = { values: sizes };
  }

  return {
    mode: "full",
    page: 1,
    page_size: MAX_RESULTS,
    size: MAX_RESULTS,
    filters: exploFilters,
  };
}

/** Normalise a raw Explorium business record to spec schema */
function normaliseBusiness(raw) {
  return {
    type: "company",
    name: raw.name || null,
    domain: raw.domain || raw.website || null,
    industry: raw.naics_description || raw.sic_code_description || null,
    revenue: raw.yearly_revenue_range || null,
    employee_count: raw.number_of_employees_range || null,
    country: raw.country_name || null,
    linkedin_url: raw.linkedin_profile || null,
    founded_year: null,  // not in fetch response; available via enrichment
    tech_stack: raw.business_intent_topics || [],
    key_contacts: [],
    description: raw.business_description || null,
    city: raw.city_name || null,
    region: raw.region || null,
    raw,
  };
}

/** Normalise a raw Explorium prospect record to spec schema */
function normaliseProspect(raw) {
  // Explorium prospect has: full_name, job_title, company_name, country_name, linkedin (not linkedin_url)
  const liUrl = raw.linkedin || raw.linkedin_url
    ? `https://${(raw.linkedin || raw.linkedin_url || '').replace(/^https?:\/\//, '')}`
    : null;
  return {
    type: "prospect",
    name: raw.full_name || raw.name || null,
    title: raw.job_title || raw.title || null,
    company: raw.company_name || raw.company || null,
    email: raw.professional_email_hashed ? "[hashed]" : raw.email || null,
    country: raw.country_name || raw.country || null,
    linkedin_url: liUrl,
    skills: raw.skills || [],
    department: raw.job_department_main || null,
    level: raw.job_level_main || null,
    raw,
  };
}

export async function searchExplorium(entityType, filters) {
  const isProspect = entityType === "prospect";
  const endpoint = isProspect
    ? `${EXPLORIUM_BASE}/prospects`
    : `${EXPLORIUM_BASE}/businesses`;
  const payload = isProspect ? buildProspectPayload(filters) : buildBusinessPayload(filters);

  let response;
  try {
    response = await fetch(endpoint, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
  } catch (err) {
    throw new Error(`Explorium network error: ${err.message}`);
  }

  if (response.status === 401 || response.status === 403) {
    throw new Error("Explorium authentication failed — check EXPLORIUM_API_KEY");
  }
  if (response.status === 429) {
    throw new Error("Explorium quota exceeded — try again later");
  }
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Explorium API error ${response.status}: ${body.slice(0, 300)}`);
  }

  const data = await response.json();
  // Explorium returns results in `data` array
  const raw = data.data || data.results || [];

  const sliced = raw.slice(0, MAX_RESULTS);
  return sliced.map(item => isProspect ? normaliseProspect(item) : normaliseBusiness(item));
}
