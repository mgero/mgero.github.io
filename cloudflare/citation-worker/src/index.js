const CACHE_KEY = "google-scholar-metrics-v1";
const MAX_STALE_AGE_MS = 26 * 60 * 60 * 1000;
const MAX_PAGES = 3;
const RESULTS_PER_PAGE = 100;

function normalizeMetricKey(value) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "");
}

function metricValue(table, acceptedKeys) {
  const normalizedKeys = acceptedKeys.map(normalizeMetricKey);
  for (const row of table || []) {
    for (const [key, value] of Object.entries(row)) {
      if (normalizedKeys.includes(normalizeMetricKey(key))) return Number(value?.all ?? 0);
    }
  }
  return 0;
}

export function parseScholarPages(pages, fetchedAt = new Date().toISOString()) {
  const firstPage = pages[0] || {};
  const articles = pages.flatMap((page) => page.articles || []);
  const metricTable = firstPage.cited_by?.table || [];
  const papers = {};

  for (const article of articles) {
    if (!article.citation_id) continue;
    papers[article.citation_id] = {
      citations: Number(article.cited_by?.value ?? 0),
      title: article.title || "",
      year: article.year || "",
    };
  }

  return {
    metadata: {
      fetched_at: fetchedAt,
      last_updated: fetchedAt.slice(0, 10),
      source: "Google Scholar via SerpAPI",
    },
    author: {
      name: firstPage.author?.name || "",
      publications: Object.keys(papers).length,
      citations: metricValue(metricTable, ["citations"]),
      h_index: metricValue(metricTable, ["h_index", "index_h", "indice_h"]),
    },
    papers,
  };
}

async function fetchScholarPage(env, start) {
  const url = new URL("https://serpapi.com/search.json");
  url.searchParams.set("engine", "google_scholar_author");
  url.searchParams.set("author_id", env.SCHOLAR_AUTHOR_ID);
  url.searchParams.set("hl", "en");
  url.searchParams.set("num", String(RESULTS_PER_PAGE));
  url.searchParams.set("start", String(start));
  url.searchParams.set("api_key", env.SERPAPI_KEY);

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`SerpAPI returned HTTP ${response.status}`);
  const data = await response.json();
  if (data.error) throw new Error(`SerpAPI error: ${data.error}`);
  return data;
}

export async function refreshMetrics(env) {
  if (!env.SERPAPI_KEY) throw new Error("SERPAPI_KEY secret is not configured");
  if (!env.SCHOLAR_AUTHOR_ID) throw new Error("SCHOLAR_AUTHOR_ID is not configured");

  const pages = [];
  for (let pageIndex = 0; pageIndex < MAX_PAGES; pageIndex += 1) {
    const page = await fetchScholarPage(env, pageIndex * RESULTS_PER_PAGE);
    pages.push(page);
    if (!page.serpapi_pagination?.next || (page.articles || []).length < RESULTS_PER_PAGE) break;
  }

  const metrics = parseScholarPages(pages);
  if (!metrics.author.citations || !metrics.author.publications) {
    throw new Error("SerpAPI returned incomplete Scholar metrics");
  }
  return metrics;
}

async function refreshAndStore(env) {
  const metrics = await refreshMetrics(env);
  await env.CITATION_CACHE.put(CACHE_KEY, JSON.stringify(metrics));
  return metrics;
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("Origin");
  const allowed = new Set((env.ALLOWED_ORIGINS || "").split(",").map((value) => value.trim()));
  return origin && allowed.has(origin) ? origin : null;
}

function responseHeaders(request, env) {
  const headers = {
    "Cache-Control": "public, max-age=300, stale-while-revalidate=86400",
    "Content-Type": "application/json; charset=utf-8",
    Vary: "Origin",
  };
  const origin = allowedOrigin(request, env);
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

function jsonResponse(request, env, body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: responseHeaders(request, env),
  });
}

async function handleRequest(request, env, ctx) {
  const url = new URL(request.url);
  if (request.method === "OPTIONS") {
    const headers = responseHeaders(request, env);
    headers["Access-Control-Allow-Methods"] = "GET, OPTIONS";
    headers["Access-Control-Allow-Headers"] = "Accept";
    return new Response(null, { status: 204, headers });
  }
  if (request.method !== "GET" || url.pathname !== "/metrics") {
    return jsonResponse(request, env, { error: "Not found" }, 404);
  }

  let metrics = await env.CITATION_CACHE.get(CACHE_KEY, "json");
  if (!metrics) {
    try {
      metrics = await refreshAndStore(env);
    } catch (_error) {
      return jsonResponse(request, env, { error: "Metrics temporarily unavailable" }, 503);
    }
  } else {
    const fetchedAt = new Date(metrics.metadata?.fetched_at).getTime();
    if (!Number.isFinite(fetchedAt) || Date.now() - fetchedAt > MAX_STALE_AGE_MS) {
      ctx.waitUntil(refreshAndStore(env).catch(() => {}));
    }
  }

  return jsonResponse(request, env, metrics);
}

export default {
  fetch: handleRequest,
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(refreshAndStore(env));
  },
};
