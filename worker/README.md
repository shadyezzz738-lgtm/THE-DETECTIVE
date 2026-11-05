# THE-DETECTIVE AI Worker

A small Cloudflare Worker proxy for the game's case-aware Gemini interrogation.

## Safety design
- Gemini API key is stored as a Cloudflare Worker secret, never in the game, APK, or Git repository.
- The Worker builds its own system instruction. It does **not** trust a system prompt supplied by the game client.
- The client sends only the currently loaded case/suspect dossier, collected evidence, short dialogue history, and the player's question.
- The dossier deliberately excludes the hidden solution object (for example, `c.v.end`).
- Approximate Cloudflare edge rate limit: 20 requests per minute per IP. Mobile networks may share IP addresses; the limit is a basic abuse barrier, not strict global accounting.
- Provider errors, including free-tier quota exhaustion (HTTP 429), are passed back so the game falls back to local responses.

## Deploy (free-tier starting setup)
1. Create a Cloudflare account and install Wrangler 4.36.0 or newer.
2. In this folder run `npm install -D wrangler`.
3. Create a Gemini API key in Google AI Studio. Do not paste it into source code or GitHub.
4. Set the secret: `npx wrangler secret put GEMINI_API_KEY`.
5. Set `ALLOWED_ORIGIN` to the exact web origin hosting the game when using the web build. For Android WebView builds, confirm the WebView origin and configure the corresponding allowed origin; do not assume it is the same as the website.
6. Deploy: `npx wrangler deploy`.
7. Test: open `https://YOUR-WORKER.workers.dev/health`. It should report `gemini-configured`.

The default model is `gemini-3.5-flash-lite`; change `GEMINI_MODEL` in `wrangler.jsonc` only after checking the model is available to your AI Studio project and its free-tier limits.

## Connect the game
Set `window.TD_AI_CONFIG.endpoint` to `https://YOUR-WORKER.workers.dev/ask` in the game configuration. The game will keep its local fallback when the Worker is unavailable or Gemini's free quota is exhausted.

## Important
- A Gemini free tier is quota-limited and can change. This project does not enable paid billing or automatic paid fallback.
- Cloudflare Workers free-plan quotas and Gemini free-tier availability are controlled by their providers and can change.
- This Worker is a deployment template; it is not live until deployed in an account and configured with a secret.
