(function () {
  const script = document.getElementById("citation-metrics-script");
  if (!script?.dataset.endpoint) return;

  const targets = document.querySelectorAll("[data-scholar-metric], .google-scholar-citation-badge");
  if (!targets.length) return;

  const cacheKey = "citation-metrics-v1";
  const cacheMaxAge = 60 * 60 * 1000;

  function readCache() {
    try {
      const cached = JSON.parse(localStorage.getItem(cacheKey));
      if (Date.now() - new Date(cached?.storedAt).getTime() < cacheMaxAge) return cached.metrics;
    } catch (_error) {
      return null;
    }
    return null;
  }

  function writeCache(metrics) {
    try {
      localStorage.setItem(cacheKey, JSON.stringify({ storedAt: new Date().toISOString(), metrics }));
    } catch (_error) {
      // The live counters still work when browser storage is disabled.
    }
  }

  function updateAuthorMetrics(metrics) {
    const values = {
      citations: metrics.author?.citations,
      h_index: metrics.author?.h_index,
      publications: metrics.author?.publications,
    };
    document.querySelectorAll("[data-scholar-metric]").forEach((element) => {
      const metric = element.dataset.scholarMetric;
      if (metric === "last_updated" && metrics.metadata?.last_updated) {
        const date = new Date(`${metrics.metadata.last_updated}T00:00:00Z`);
        element.textContent = date.toLocaleDateString("en-US", {
          day: "numeric",
          month: "long",
          timeZone: "UTC",
          year: "numeric",
        });
      } else if (Number.isFinite(values[metric])) {
        element.textContent = values[metric].toLocaleString("en-US");
      }
    });
  }

  function updatePublicationBadges(metrics) {
    const papersById = new Map();
    Object.entries(metrics.papers || {}).forEach(([citationId, paper]) => {
      papersById.set(citationId.split(":").pop(), paper);
    });

    document.querySelectorAll(".google-scholar-citation-badge").forEach((badge) => {
      const paper = papersById.get(badge.dataset.scholarId);
      if (!paper || !Number.isFinite(paper.citations)) return;
      const image = badge.querySelector("img");
      image.src = `https://img.shields.io/badge/scholar-${paper.citations}-4285F4?logo=googlescholar&labelColor=beige`;
      image.alt = `${paper.citations} Google Scholar citations`;
    });
  }

  function render(metrics) {
    if (!metrics?.author) return;
    updateAuthorMetrics(metrics);
    updatePublicationBadges(metrics);
  }

  const cached = readCache();
  if (cached) {
    render(cached);
    return;
  }

  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 8000);
  fetch(script.dataset.endpoint, {
    headers: { Accept: "application/json" },
    mode: "cors",
    signal: controller.signal,
  })
    .then((response) => {
      if (!response.ok) throw new Error(`Citation endpoint returned ${response.status}`);
      return response.json();
    })
    .then((metrics) => {
      writeCache(metrics);
      render(metrics);
    })
    .catch(() => {
      // Keep the citation counts embedded during the last Jekyll build.
    })
    .finally(() => window.clearTimeout(timeout));
})();
