import assert from "node:assert/strict";
import test from "node:test";

import worker, { parseScholarPages } from "../src/index.js";

const examplePage = {
  author: { name: "Michele Geronazzo" },
  articles: [
    {
      citation_id: "FZi4M7kAAAAJ:example",
      title: "Example paper",
      year: "2026",
      cited_by: { value: 42 },
    },
  ],
  cited_by: {
    table: [{ citations: { all: 1900 } }, { h_index: { all: 22 } }],
  },
};

test("parseScholarPages builds the public metrics payload", () => {
  const result = parseScholarPages([examplePage], "2026-08-07T12:00:00.000Z");
  assert.equal(result.author.name, "Michele Geronazzo");
  assert.equal(result.author.publications, 1);
  assert.equal(result.author.citations, 1900);
  assert.equal(result.author.h_index, 22);
  assert.equal(result.papers["FZi4M7kAAAAJ:example"].citations, 42);
  assert.equal(result.metadata.last_updated, "2026-08-07");
});

test("GET /metrics serves cached data without exposing secrets", async () => {
  const cached = parseScholarPages([examplePage], "2026-08-07T12:00:00.000Z");
  const env = {
    ALLOWED_ORIGINS: "https://mgero.github.io",
    SERPAPI_KEY: "must-not-be-returned",
    CITATION_CACHE: {
      get: async () => cached,
      put: async () => assert.fail("fresh cache must not be replaced"),
    },
  };
  const request = new Request("https://metrics.example/metrics", {
    headers: { Origin: "https://mgero.github.io" },
  });
  const response = await worker.fetch(request, env, { waitUntil: () => {} });
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Access-Control-Allow-Origin"), "https://mgero.github.io");
  assert.doesNotMatch(text, /must-not-be-returned/);
  assert.equal(JSON.parse(text).author.citations, 1900);
});
