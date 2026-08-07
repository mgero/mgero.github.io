(function () {
  const script = document.getElementById("openalex-metrics-script");
  if (!script) return;

  const authorId = script.dataset.authorId;
  const contactEmail = script.dataset.contactEmail;
  const cacheHours = Number(script.dataset.cacheHours) || 24;
  const cacheKey = `openalex-metrics-v1-${authorId}`;
  const cacheMaxAge = cacheHours * 60 * 60 * 1000;
  const hasMetrics = document.querySelectorAll("[data-openalex-author-metric], .openalex-citation-badge").length > 0;
  if (!authorId || !hasMetrics) return;

  function apiUrl(path, parameters = {}) {
    const url = new URL(`https://api.openalex.org/${path}`);
    Object.entries(parameters).forEach(([key, value]) => url.searchParams.set(key, value));
    if (contactEmail) url.searchParams.set("mailto", contactEmail);
    return url;
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(cacheKey));
    } catch (_error) {
      return null;
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify(data));
    } catch (_error) {
      // Metrics still work when storage is disabled; they will simply be fetched again.
    }
  }

  async function fetchJson(url) {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      mode: "cors",
    });
    if (!response.ok) throw new Error(`OpenAlex request failed with ${response.status}`);
    return response.json();
  }

  async function fetchMetrics() {
    const [author, worksResponse] = await Promise.all([
      fetchJson(apiUrl(`authors/${authorId}`)),
      fetchJson(
        apiUrl("works", {
          filter: `author.id:${authorId}`,
          "per-page": "200",
          select: "id,doi,display_name,cited_by_count,publication_year",
        })
      ),
    ]);

    const data = {
      fetchedAt: new Date().toISOString(),
      author,
      works: worksResponse.results || [],
    };
    writeCache(data);
    return data;
  }

  function normalizeDoi(value) {
    return (value || "")
      .trim()
      .toLowerCase()
      .replace(/^https?:\/\/(?:dx\.)?doi\.org\//, "")
      .replace(/^doi:\s*/, "");
  }

  function normalizeTitle(value) {
    return (value || "")
      .replace(/\\[a-zA-Z]+\*?(?:\[[^\]]*\])?/g, " ")
      .replace(/\\["'`^~=.](?:\s*\{)?([a-zA-Z])\}?/g, "$1")
      .replace(/[{}]/g, "")
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ")
      .trim();
  }

  function updateAuthorMetrics(data) {
    const values = {
      works_count: data.author.works_count,
      cited_by_count: data.author.cited_by_count,
      h_index: data.author.summary_stats?.h_index,
    };

    document.querySelectorAll("[data-openalex-author-metric]").forEach((element) => {
      const value = values[element.dataset.openalexAuthorMetric];
      if (Number.isFinite(value)) element.textContent = value.toLocaleString("en-US");
    });

    const retrievedDate = new Date(data.fetchedAt);
    if (!Number.isNaN(retrievedDate.getTime())) {
      const label = retrievedDate.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
      document.querySelectorAll("[data-openalex-retrieved-date]").forEach((element) => {
        element.textContent = label;
      });
    }
  }

  function updatePublicationBadges(data) {
    const worksByDoi = new Map();
    const worksByTitle = new Map();

    data.works.forEach((work) => {
      const doi = normalizeDoi(work.doi);
      const title = normalizeTitle(work.display_name);
      if (doi) worksByDoi.set(doi, work);
      if (title) {
        const candidates = worksByTitle.get(title) || [];
        candidates.push(work);
        worksByTitle.set(title, candidates);
      }
    });

    document.querySelectorAll(".openalex-citation-badge").forEach((badge) => {
      const doi = normalizeDoi(badge.dataset.openalexDoi);
      const title = normalizeTitle(badge.dataset.openalexTitle);
      const year = badge.dataset.openalexYear;
      let work = doi ? worksByDoi.get(doi) : null;

      if (!work && title) {
        const candidates = (worksByTitle.get(title) || []).filter((candidate) => !year || String(candidate.publication_year) === year);
        if (candidates.length === 1) work = candidates[0];
      }

      if (!work || !Number.isFinite(work.cited_by_count)) return;

      const count = work.cited_by_count;
      const openAlexId = work.id.split("/").pop();
      const image = badge.querySelector("img");
      badge.href = `https://openalex.org/${openAlexId}`;
      badge.hidden = false;
      image.src = `https://img.shields.io/badge/OpenAlex-${count}-2D8CFF?labelColor=beige`;
      image.alt = `${count} OpenAlex citations`;
    });
  }

  function render(data) {
    if (!data?.author || !Array.isArray(data.works)) return;
    updateAuthorMetrics(data);
    updatePublicationBadges(data);
  }

  const cached = readCache();
  if (cached) render(cached);

  if (!cached || Date.now() - new Date(cached.fetchedAt).getTime() >= cacheMaxAge) {
    fetchMetrics()
      .then(render)
      .catch(() => {
        // Keep the static snapshot or stale local cache when OpenAlex is unavailable.
      });
  }
})();
