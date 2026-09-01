# Citation metrics Worker

This Cloudflare Worker fetches Google Scholar author metrics through SerpAPI, stores the public result in Workers KV, and exposes only the cached counters at `GET /metrics`. The SerpAPI key is a Cloudflare secret and is never sent to the website.

## One-time setup

1. Create a free SerpAPI account and copy its private API key.
2. Log in to Cloudflare from this directory:

   ```bash
   npx wrangler login
   ```

3. Deploy the Worker. Wrangler automatically creates and binds the KV namespace during this first deployment:

   ```bash
   npm run deploy
   ```

4. Store the SerpAPI key without adding it to a file or Git. This command creates and immediately deploys a new Worker version containing the encrypted secret binding:

   ```bash
   npx wrangler secret put SERPAPI_KEY
   ```

5. Copy the resulting `https://...workers.dev/metrics` URL into `_config.yml` as `citation_metrics.endpoint`, then deploy the Jekyll site once.

The Worker refreshes at 01:15 UTC every day. With up to 300 Scholar articles it uses at most three SerpAPI searches per refresh, remaining below the free plan's 250 monthly searches for a daily schedule.

## Local verification

```bash
npm test
```
